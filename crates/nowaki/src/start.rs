//! 本番配信の Rust ホットパス。`nowaki start` が使う。
//!
//! Rust(axum) が HTTP エッジ・静的配信(dist/client)・HTML 組み立て(island 配線・preload)を担い、
//! Node の prod-sidecar は「コンポーネント描画」だけを行う（ページは body+メタを JSON で返す）。
//! API/リダイレクト/ストリーミングはサイドカー応答をそのまま素通しする。
//! デプロイ用の自己完結物（node/edge アダプタ）とは別経路。これは v0.6 Jetstream の足場でもある。

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use axum::body::Body;
use axum::extract::ws::WebSocketUpgrade;
use axum::extract::{Request, State};
use axum::http::{header, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get};
use axum::Router;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

#[derive(serde::Deserialize, Default)]
struct Manifest {
    runtime: Option<String>,
    #[serde(default, rename = "liveRuntime")]
    live_runtime: Option<String>,
    #[serde(default)]
    islands: HashMap<String, String>,
    #[serde(default)]
    preload: HashMap<String, Vec<String>>,
}

#[derive(serde::Deserialize)]
struct PageMeta {
    body: String,
    title: String,
    head: String,
    lang: String,
}

struct ProdState {
    client_dir: PathBuf,
    sidecar_port: u16,
    http: reqwest::Client,
    manifest: Manifest,
    live_hub: Arc<crate::live::LiveHub>,
    isr: IsrCache,
    _child: Child, // kill_on_drop で終了時にサイドカーを落とす
}

/// ISR（incremental static regeneration）のメモリキャッシュ。
/// ルートが `export const revalidate = <秒>` を持つと、組み立て済み HTML を
/// path+query 単位で保持する。鮮度切れは「古い HTML を即返しつつ裏で再生成」する。
struct IsrCache {
    entries: Mutex<HashMap<String, Arc<CacheEntry>>>,
    inflight: Mutex<HashSet<String>>, // 再検証の単一フライト
    max: usize,                       // エントリ数の上限（超過時は最古を追い出す）
}

struct CacheEntry {
    status: u16,
    html: String,
    headers: Vec<(String, String)>, // 復元する応答ヘッダ（cookie/長さ系は除外済み）
    stored_at: Instant,
    revalidate: Duration,
}

impl IsrCache {
    fn new() -> Self {
        let max = std::env::var("NOWAKI_ISR_MAX")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .filter(|n| *n > 0)
            .unwrap_or(1024);
        IsrCache {
            entries: Mutex::new(HashMap::new()),
            inflight: Mutex::new(HashSet::new()),
            max,
        }
    }
}

pub async fn run(root: PathBuf, port: u16, expose: bool) -> Result<()> {
    let started = std::time::Instant::now();
    let client_dir = root.join("dist/client");
    if !client_dir.join("manifest.json").exists() {
        anyhow::bail!(
            "まだビルドされていません。先に `nowaki build {}` を実行してください。",
            root.display()
        );
    }
    let entry = root.join("node_modules/@nowaki-dev/runtime/server/prod-sidecar.mjs");
    if !entry.exists() {
        anyhow::bail!(
            "依存がインストールされていません（{} が見つかりません）。\n  → アプリのディレクトリで `npm install` を実行してください。",
            entry.display()
        );
    }

    // Node prod-sidecar をエフェメラルポートで起動し、READY 行からポートを得る。
    let mut child = Command::new("node")
        .arg("--enable-source-maps")
        .arg(&entry)
        .current_dir(&root)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .context("prod-sidecar (node) の起動に失敗")?;
    let stdout = child.stdout.take().expect("piped stdout");
    let mut lines = BufReader::new(stdout).lines();
    let mut sidecar_port = None;
    while let Some(line) = lines.next_line().await? {
        if let Some(rest) = line.strip_prefix("NOWAKI_START_READY ") {
            sidecar_port = Some(rest.trim().parse::<u16>().context("サイドカーポート不正")?);
            break;
        }
        println!("[sidecar] {line}");
    }
    let sidecar_port =
        sidecar_port.ok_or_else(|| anyhow!("prod-sidecar が READY を報告せず終了しました"))?;
    tokio::spawn(async move {
        while let Ok(Some(l)) = lines.next_line().await {
            println!("[sidecar] {l}");
        }
    });

    let manifest_text = std::fs::read_to_string(client_dir.join("manifest.json"))?;
    let manifest: Manifest = serde_json::from_str(&manifest_text).unwrap_or_default();

    // --host で全インターフェース公開。既定は NOWAKI_HOST or 127.0.0.1。
    let host = if expose {
        "0.0.0.0".to_string()
    } else {
        std::env::var("NOWAKI_HOST").unwrap_or_else(|_| "127.0.0.1".to_string())
    };
    let state = Arc::new(ProdState {
        client_dir,
        sidecar_port,
        http: reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()?,
        manifest,
        live_hub: crate::live::LiveHub::new(),
        isr: IsrCache::new(),
        _child: child,
    });

    let app = Router::new()
        .route("/__nowaki/live", get(live_ws))
        .fallback(any(handle))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind((host.as_str(), port)).await?;
    let actual = listener.local_addr()?.port();
    // PORT=0 のときの実ポートも報告（prerender / アダプタ / bench が grep するマーカー。維持）。
    println!("NOWAKI_START_READY {actual}");
    crate::ui::server_banner(
        "Nowaki (production)",
        env!("CARGO_PKG_VERSION"),
        actual,
        started.elapsed().as_millis(),
        &["Rust front", "Node renderer"],
        expose || host == "0.0.0.0",
    );
    axum::serve(listener, app).await?;
    Ok(())
}

/// サーバーリアクティブ島の WS。セッションは crate::live、描画は Node prod-sidecar へ橋渡し。
async fn live_ws(ws: WebSocketUpgrade, State(state): State<Arc<ProdState>>) -> Response {
    let http = state.http.clone();
    let port = state.sidecar_port;
    let hub = state.live_hub.clone();
    ws.on_upgrade(move |socket| crate::live::handle(socket, hub, http, port, "prod".to_string()))
}

async fn handle(State(state): State<Arc<ProdState>>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    // 静的アセットは Rust が直接配信（高ボリュームのホットパス）。
    if req.method() == Method::GET && path.starts_with("/_nowaki/") {
        return serve_static(&state, &path).await;
    }
    // GET ページは ISR キャッシュ（stale-while-revalidate）を経由する。
    if req.method() == Method::GET {
        let key = req
            .uri()
            .path_and_query()
            .map(|pq| pq.as_str().to_string())
            .unwrap_or_else(|| "/".to_string());
        if let Some(resp) = isr_lookup(&state, &key) {
            return resp;
        }
        return proxy(state, req, Some(key)).await;
    }
    proxy(state, req, None).await
}

/// ISR キャッシュ参照。鮮度内なら HIT、鮮度切れなら STALE を即返しつつ裏で再検証する。
fn isr_lookup(state: &Arc<ProdState>, key: &str) -> Option<Response> {
    let entry = state.isr.entries.lock().unwrap().get(key).cloned()?;
    let stale = entry.stored_at.elapsed() >= entry.revalidate;
    if stale {
        spawn_revalidate(state.clone(), key.to_string());
    }
    Some(cached_response(&entry, if stale { "STALE" } else { "HIT" }))
}

/// キャッシュ済みエントリから応答を組み立てる（x-nowaki-cache でヒット種別を示す）。
fn cached_response(entry: &CacheEntry, cache_status: &str) -> Response {
    let mut builder = Response::builder()
        .status(entry.status)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .header("x-nowaki-cache", cache_status);
    for (n, v) in &entry.headers {
        builder = builder.header(n.as_str(), v.as_str());
    }
    builder
        .body(Body::from(entry.html.clone()))
        .unwrap_or_else(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response())
}

/// 鮮度切れエントリを裏で再生成する（単一フライト: 同じキーは1本だけ走らせる）。
fn spawn_revalidate(state: Arc<ProdState>, key: String) {
    {
        let mut inflight = state.isr.inflight.lock().unwrap();
        if !inflight.insert(key.clone()) {
            return; // すでに再検証中
        }
    }
    tokio::spawn(async move {
        let _ = revalidate_entry(&state, &key).await;
        state.isr.inflight.lock().unwrap().remove(&key);
    });
}

/// サイドカーへクリーンな GET を投げて（ユーザーの cookie/header は載せない）キャッシュを更新する。
async fn revalidate_entry(state: &Arc<ProdState>, key: &str) -> Option<()> {
    let url = format!("http://127.0.0.1:{}{}", state.sidecar_port, key);
    let resp = state.http.get(&url).send().await.ok()?;
    let entry = page_to_entry(state, resp).await?;
    isr_store(state, key, entry);
    Some(())
}

/// サイドカー応答が ISR キャッシュ可能なページなら CacheEntry にする。
/// 条件: 200 / x-nowaki-page / x-nowaki-revalidate>0 / Set-Cookie 無し（per-user は除外）。
async fn page_to_entry(state: &ProdState, resp: reqwest::Response) -> Option<CacheEntry> {
    if resp.status() != StatusCode::OK {
        return None;
    }
    let h = resp.headers();
    if !h.contains_key("x-nowaki-page") || h.contains_key(header::SET_COOKIE) {
        return None;
    }
    let secs = isr_secs_of(h)?;
    let kept = kept_headers(h);
    let status = resp.status().as_u16();
    let bytes = resp.bytes().await.ok()?;
    let meta: PageMeta = serde_json::from_slice(&bytes).ok()?;
    let html = assemble(&state.manifest, &meta);
    Some(CacheEntry {
        status,
        html,
        headers: kept,
        stored_at: Instant::now(),
        revalidate: Duration::from_secs(secs),
    })
}

/// x-nowaki-revalidate ヘッダを正の秒数として読む。
fn isr_secs_of(h: &reqwest::header::HeaderMap) -> Option<u64> {
    h.get("x-nowaki-revalidate")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .filter(|n| *n > 0)
}

/// キャッシュへ復元する応答ヘッダを集める（x-nowaki-* / content-type / 長さ系 / Set-Cookie は除外）。
fn kept_headers(h: &reqwest::header::HeaderMap) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for (name, value) in h.iter() {
        let n = name.as_str();
        if n.starts_with("x-nowaki-")
            || name == header::CONTENT_TYPE
            || name == header::CONTENT_LENGTH
            || name == header::TRANSFER_ENCODING
            || name == header::SET_COOKIE
        {
            continue;
        }
        if let Ok(v) = value.to_str() {
            out.push((n.to_string(), v.to_string()));
        }
    }
    out
}

/// エントリを保存。上限超過時は最古を1件追い出す（簡易 LRU）。
fn isr_store(state: &ProdState, key: &str, entry: CacheEntry) {
    let mut map = state.isr.entries.lock().unwrap();
    if map.len() >= state.isr.max && !map.contains_key(key) {
        if let Some(oldest) = map
            .iter()
            .min_by_key(|(_, e)| e.stored_at)
            .map(|(k, _)| k.clone())
        {
            map.remove(&oldest);
        }
    }
    map.insert(key.to_string(), Arc::new(entry));
}

async fn serve_static(state: &ProdState, path: &str) -> Response {
    let name = path.rsplit('/').next().unwrap_or(""); // basename で traversal 防止
    let file = state.client_dir.join(name);
    match tokio::fs::read(&file).await {
        Ok(bytes) => (
            [
                (header::CONTENT_TYPE, content_type(name)),
                (header::CACHE_CONTROL, "public, max-age=31536000, immutable"),
            ],
            bytes,
        )
            .into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "not found").into_response(),
    }
}

async fn proxy(state: Arc<ProdState>, req: Request, cache_key: Option<String>) -> Response {
    let path_q = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str().to_string())
        .unwrap_or_else(|| "/".to_string());
    let url = format!("http://127.0.0.1:{}{}", state.sidecar_port, path_q);
    let method = req.method().clone();
    let headers = req.headers().clone();
    let body = match axum::body::to_bytes(req.into_body(), 16 * 1024 * 1024).await {
        Ok(b) => b,
        Err(e) => return (StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    };

    let mut builder = state.http.request(method, &url).body(body.to_vec());
    for (name, value) in headers.iter() {
        if name != header::HOST {
            builder = builder.header(name, value);
        }
    }

    let resp = match builder.send().await {
        Ok(r) => r,
        Err(err) => {
            return (
                StatusCode::BAD_GATEWAY,
                format!("prod-sidecar への接続に失敗: {err}"),
            )
                .into_response()
        }
    };

    let status = resp.status();
    let is_page = resp.headers().get("x-nowaki-page").is_some();
    let resp_headers = resp.headers().clone();
    let bytes = resp.bytes().await.unwrap_or_default();

    if is_page {
        // ページ: サイドカーが返した body+メタ(JSON)を Rust が完成 HTML に組み立てる。
        let html = match serde_json::from_slice::<PageMeta>(&bytes) {
            Ok(meta) => assemble(&state.manifest, &meta),
            Err(_) => String::from_utf8_lossy(&bytes).to_string(),
        };
        // ISR: GET の cacheable ページならメモリへ保存し、この応答は MISS とする。
        let isr_secs = match (&cache_key, status) {
            (Some(_), StatusCode::OK) => isr_secs_of(&resp_headers),
            _ => None,
        };
        let mut builder = Response::builder()
            .status(status.as_u16())
            .header(header::CONTENT_TYPE, "text/html; charset=utf-8");
        if isr_secs.is_some() {
            builder = builder.header("x-nowaki-cache", "MISS");
        }
        // cookie 等の応答ヘッダは保つ（x-nowaki-* と長さ系は除く）。
        for (name, value) in resp_headers.iter() {
            let n = name.as_str();
            if n.starts_with("x-nowaki-")
                || name == header::CONTENT_TYPE
                || name == header::CONTENT_LENGTH
                || name == header::TRANSFER_ENCODING
            {
                continue;
            }
            builder = builder.header(name, value);
        }
        // Set-Cookie が無いときだけ保存（per-user 応答は共有キャッシュに入れない）。
        if let (Some(secs), Some(key)) = (isr_secs, cache_key.as_ref()) {
            if !resp_headers.contains_key(header::SET_COOKIE) {
                isr_store(
                    &state,
                    key,
                    CacheEntry {
                        status: status.as_u16(),
                        html: html.clone(),
                        headers: kept_headers(&resp_headers),
                        stored_at: Instant::now(),
                        revalidate: Duration::from_secs(secs),
                    },
                );
            }
        }
        builder
            .body(Body::from(html))
            .unwrap_or_else(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response())
    } else {
        // 素通し（API / redirect / stream / streaming SSR / 組み込み 404・500）。
        let mut builder = Response::builder().status(status.as_u16());
        for (name, value) in resp_headers.iter() {
            if name != header::TRANSFER_ENCODING && name != header::CONTENT_LENGTH {
                builder = builder.header(name, value);
            }
        }
        builder
            .body(Body::from(bytes))
            .unwrap_or_else(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response())
    }
}

/// 描画済み body とメタから完成 HTML を組み立てる（island 配線 + modulepreload）。
/// prodDocument(JS) の Rust 版。island は body 中の <nowaki-island name="..."> から拾う。
fn assemble(manifest: &Manifest, meta: &PageMeta) -> String {
    let island_names = scan_island_names(&meta.body);
    let has_islands = !island_names.is_empty() && manifest.runtime.is_some();

    let mut preload_files: Vec<String> = Vec::new();
    if has_islands {
        let runtime = manifest.runtime.clone().unwrap();
        let mut entry_chunks = vec![runtime];
        for n in &island_names {
            if let Some(f) = manifest.islands.get(n) {
                entry_chunks.push(f.clone());
            }
        }
        let mut seen = HashSet::new();
        for chunk in entry_chunks {
            if seen.insert(chunk.clone()) {
                preload_files.push(chunk.clone());
            }
            if let Some(deps) = manifest.preload.get(&chunk) {
                for dep in deps {
                    if seen.insert(dep.clone()) {
                        preload_files.push(dep.clone());
                    }
                }
            }
        }
    }
    let preload = preload_files
        .iter()
        .map(|f| format!("<link rel=\"modulepreload\" href=\"/_nowaki/{f}\" />"))
        .collect::<Vec<_>>()
        .join("\n");
    let runtime_script = if has_islands {
        format!(
            "<script type=\"module\" src=\"/_nowaki/{}\"></script>",
            manifest.runtime.as_ref().unwrap()
        )
    } else {
        String::new()
    };
    // サーバーリアクティブ島があれば live.js（WS + morph）を読み込む。
    let live_script = if meta.body.contains("<nowaki-live") {
        match &manifest.live_runtime {
            Some(f) => format!("<script type=\"module\" src=\"/_nowaki/{f}\"></script>"),
            None => String::new(),
        }
    } else {
        String::new()
    };

    format!(
        "<!DOCTYPE html>\n<html lang=\"{lang}\">\n<head>\n<meta charset=\"utf-8\" />\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n<title>{title}</title>\n{preload}\n{head}\n</head>\n<body>\n{body}\n{runtime_script}\n{live_script}\n</body>\n</html>",
        lang = escape_html(&meta.lang),
        title = escape_html(&meta.title),
        head = meta.head,
        body = meta.body,
    )
}

/// body から <nowaki-island name="NAME"> の NAME を順不同で集める。
fn scan_island_names(body: &str) -> Vec<String> {
    let mut out = Vec::new();
    let needle = "<nowaki-island name=\"";
    let mut rest = body;
    while let Some(i) = rest.find(needle) {
        let after = &rest[i + needle.len()..];
        if let Some(end) = after.find('"') {
            out.push(after[..end].to_string());
            rest = &after[end..];
        } else {
            break;
        }
    }
    out
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn content_type(name: &str) -> &'static str {
    match name.rsplit('.').next().unwrap_or("") {
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" | "map" => "application/json",
        "css" => "text/css; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}
