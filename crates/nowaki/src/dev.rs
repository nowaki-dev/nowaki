use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::Result;
use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, Request, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use notify::{EventKind, RecursiveMode, Watcher};
use nowaki_core::{is_transformable, Mode, NowakiCore};
use serde_json::json;
use tokio::sync::broadcast;

use crate::sidecar;

pub struct DevState {
    core: NowakiCore,
    hmr_tx: broadcast::Sender<String>,
    ssr_version: AtomicU64,
    sidecar_port: u16,
    http: reqwest::Client,
}

pub async fn run(root: PathBuf, port: u16) -> Result<()> {
    let started = Instant::now();

    let sidecar = sidecar::spawn(&root, port).await?;
    println!("[nowaki] SSRサイドカー起動 (port {})", sidecar.port);

    let (hmr_tx, _) = broadcast::channel(64);
    let state = Arc::new(DevState {
        core: NowakiCore::new(root.clone()),
        hmr_tx: hmr_tx.clone(),
        ssr_version: AtomicU64::new(1),
        sidecar_port: sidecar.port,
        http: reqwest::Client::new(),
    });

    let _watcher = start_watcher(&root, state.clone())?;

    let app = Router::new()
        .route("/__nowaki/hmr", get(hmr_ws))
        .route("/__nowaki/ssr-module", get(ssr_module))
        .route("/@fs/{*path}", get(serve_fs))
        .fallback(serve_or_proxy)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await?;
    println!(
        "[nowaki] dev server ready: http://127.0.0.1:{port} ({}ms)",
        started.elapsed().as_millis()
    );
    axum::serve(listener, app).await?;
    drop(sidecar);
    Ok(())
}

/// ファイル監視 → ssr_version更新 + reloadブロードキャスト (100msデバウンス)
fn start_watcher(root: &Path, state: Arc<DevState>) -> Result<notify::RecommendedWatcher> {
    let root_owned = root.to_path_buf();
    let last_fire = Mutex::new(Instant::now() - Duration::from_secs(1));
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        if !matches!(
            event.kind,
            EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
        ) {
            return;
        }
        let relevant: Vec<_> = event
            .paths
            .iter()
            .filter(|p| {
                let s = p.to_string_lossy();
                !s.contains("/node_modules/")
                    && !s.contains("/.git/")
                    && !s.contains("/dist/")
                    && !s.contains("/target/")
            })
            .collect();
        if relevant.is_empty() {
            return;
        }
        {
            let mut last = last_fire.lock().unwrap();
            if last.elapsed() < Duration::from_millis(100) {
                return;
            }
            *last = Instant::now();
        }
        state.ssr_version.fetch_add(1, Ordering::SeqCst);
        // 変更が islands/ のみなら島をホットスワップ、それ以外はフルリロード
        let island_only = relevant
            .iter()
            .all(|p| p.to_string_lossy().contains("/islands/"));
        let kind = if island_only { "update" } else { "reload" };
        let _ = state.hmr_tx.send(json!({ "type": kind }).to_string());
    })?;
    watcher.watch(&root_owned, RecursiveMode::Recursive)?;
    Ok(watcher)
}

async fn hmr_ws(ws: WebSocketUpgrade, State(state): State<Arc<DevState>>) -> Response {
    ws.on_upgrade(move |socket| handle_hmr(socket, state))
}

async fn handle_hmr(mut socket: WebSocket, state: Arc<DevState>) {
    let mut rx = state.hmr_tx.subscribe();
    loop {
        tokio::select! {
            msg = rx.recv() => {
                let Ok(msg) = msg else { break };
                if socket.send(Message::Text(msg.into())).await.is_err() {
                    break;
                }
            }
            incoming = socket.recv() => {
                if incoming.is_none() {
                    break; // クライアント切断
                }
            }
        }
    }
}

#[derive(serde::Deserialize)]
pub struct SsrModuleQuery {
    path: String,
    #[allow(dead_code)] // キャッシュバスター (Nodeローダーが付与)
    v: Option<String>,
}

/// Nodeローダーフック向け: .tsx/.ts をSSRモードで変換して返す
async fn ssr_module(
    State(state): State<Arc<DevState>>,
    Query(q): Query<SsrModuleQuery>,
) -> Response {
    let path = PathBuf::from(&q.path);
    transform_response(state, path, Mode::Ssr).await
}

/// /@fs/<絶対パス> — アプリルート外 (pnpmストア等) のファイル配信
async fn serve_fs(
    State(state): State<Arc<DevState>>,
    axum::extract::Path(rest): axum::extract::Path<String>,
) -> Response {
    let abs = PathBuf::from(format!("/{rest}"));
    serve_file(state, abs).await
}

/// フォールバック: アプリルート配下のファイルならば配信、さもなくばサイドカーへSSRプロキシ
async fn serve_or_proxy(State(state): State<Arc<DevState>>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    if req.method() == axum::http::Method::GET && path != "/" {
        let candidate = state.core.root.join(path.trim_start_matches('/'));
        if candidate.is_file() {
            return serve_file(state, candidate).await;
        }
    }
    proxy_to_sidecar(state, req).await
}

async fn serve_file(state: Arc<DevState>, abs: PathBuf) -> Response {
    // .css は <style> を注入する JS シムとして配信する（import で副作用適用）
    if nowaki_core::css::is_css(&abs) {
        return match tokio::fs::read_to_string(&abs).await {
            Ok(css) => {
                let id = abs.to_string_lossy();
                let shim = nowaki_core::css::css_shim(&id, &css);
                (
                    [
                        (header::CONTENT_TYPE, "text/javascript; charset=utf-8"),
                        (header::CACHE_CONTROL, "no-cache"),
                    ],
                    shim,
                )
                    .into_response()
            }
            Err(_) => (StatusCode::NOT_FOUND, "not found").into_response(),
        };
    }
    if is_transformable(&abs) {
        return transform_response(state, abs, Mode::Browser).await;
    }
    match tokio::fs::read(&abs).await {
        Ok(bytes) => ([(header::CONTENT_TYPE, mime_for(&abs))], bytes).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "not found").into_response(),
    }
}

async fn transform_response(state: Arc<DevState>, abs: PathBuf, mode: Mode) -> Response {
    // oxc変換はCPUバウンドなのでblockingプールで実行
    let core_state = state.clone();
    let result = tokio::task::spawn_blocking(move || core_state.core.load_module(&abs, mode)).await;
    match result {
        Ok(Ok(code)) => (
            [
                (header::CONTENT_TYPE, "text/javascript; charset=utf-8"),
                (header::CACHE_CONTROL, "no-cache"),
            ],
            code,
        )
            .into_response(),
        Ok(Err(err)) => {
            let msg = format!("{err:#}");
            eprintln!("[nowaki] 変換エラー: {msg}");
            // エラーオーバーレイ用に HMR クライアントへ通知
            let _ = state
                .hmr_tx
                .send(json!({ "type": "error", "message": msg }).to_string());
            (StatusCode::INTERNAL_SERVER_ERROR, msg).into_response()
        }
        Err(join_err) => (StatusCode::INTERNAL_SERVER_ERROR, join_err.to_string()).into_response(),
    }
}

async fn proxy_to_sidecar(state: Arc<DevState>, req: Request) -> Response {
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

    let mut builder = state
        .http
        .request(method, &url)
        .header(
            "x-nowaki-ssr-version",
            state.ssr_version.load(Ordering::SeqCst).to_string(),
        )
        .body(body.to_vec());
    for (name, value) in headers.iter() {
        if name != header::HOST {
            builder = builder.header(name, value);
        }
    }

    match builder.send().await {
        Ok(resp) => {
            let status = resp.status();
            let mut response = Response::builder().status(status.as_u16());
            for (name, value) in resp.headers().iter() {
                if name != header::TRANSFER_ENCODING && name != header::CONTENT_LENGTH {
                    response = response.header(name, value);
                }
            }
            let bytes = resp.bytes().await.unwrap_or_default();
            response.body(Body::from(bytes)).unwrap_or_else(|e| {
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
            })
        }
        Err(err) => (
            StatusCode::BAD_GATEWAY,
            format!("SSRサイドカーへの接続に失敗: {err}"),
        )
            .into_response(),
    }
}

fn mime_for(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("ico") => "image/x-icon",
        Some("wasm") => "application/wasm",
        Some("map") => "application/json",
        _ => "application/octet-stream",
    }
}
