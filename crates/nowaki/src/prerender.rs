use std::path::{Path, PathBuf};
use std::process::Stdio;

use anyhow::{anyhow, Context, Result};
use nowaki_core::NowakiCore;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// 静的サイト生成: ビルド → 本番サーバーを一時起動 → 静的ルートを各HTML化 → 出力。
pub async fn run(root: PathBuf, out: PathBuf) -> Result<()> {
    // 1. build (client + server)
    let core = NowakiCore::new(root.clone());
    let report = core.build(&root.join("dist"))?;
    println!(
        "[nowaki] build: client {} / server {} modules",
        report.modules, report.server_modules
    );

    let entry = root.join("node_modules/@nowaki-dev/runtime/server/start.mjs");
    if !entry.exists() {
        return Err(anyhow!(
            "@nowaki-dev/runtime が見つかりません: {}",
            entry.display()
        ));
    }

    // 2. 本番サーバーをエフェメラルポートで起動
    let mut child = Command::new("node")
        .arg("--enable-source-maps")
        .arg(&entry)
        .current_dir(&root)
        .env("PORT", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .context("node の起動に失敗しました")?;

    let stdout = child.stdout.take().expect("piped stdout");
    let mut lines = BufReader::new(stdout).lines();
    let mut port = None;
    while let Some(line) = lines.next_line().await? {
        if let Some(rest) = line.strip_prefix("NOWAKI_START_READY ") {
            port = Some(rest.trim().parse::<u16>().context("ポート解析に失敗")?);
            break;
        }
    }
    let port = port.ok_or_else(|| anyhow!("本番サーバーが READY を報告せず終了しました"))?;

    // 3. 静的ルートを列挙（api/ と動的[param]は除外）
    let routes = enumerate_routes(&root.join("dist/server/routes"))?;
    if routes.is_empty() {
        return Err(anyhow!("プリレンダ対象の静的ルートがありません"));
    }

    // 4. 各ルートを fetch して書き出し（リダイレクトは追従せず、非200はスキップ）
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()?;
    std::fs::create_dir_all(&out)?;
    let mut count = 0;
    for url_path in &routes {
        let resp = client
            .get(format!("http://127.0.0.1:{port}{url_path}"))
            .send()
            .await?;
        if !resp.status().is_success() {
            eprintln!("[nowaki] {url_path}: {} のためスキップ", resp.status());
            continue;
        }
        let html = resp.text().await?;
        let file = out_file_for(&out, url_path);
        if let Some(parent) = file.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&file, html)?;
        count += 1;
    }

    // 5. クライアントアセットを /_nowaki へコピー + キャッシュヘッダ
    let assets = out.join("_nowaki");
    std::fs::create_dir_all(&assets)?;
    copy_dir(&root.join("dist/client"), &assets)?;
    std::fs::write(
        out.join("_headers"),
        "/_nowaki/*\n  Cache-Control: public, max-age=31536000, immutable\n",
    )?;

    drop(child);
    println!("[nowaki] prerender完了: {count} pages → {}", out.display());
    Ok(())
}

/// dist/server/routes を走査し、静的に出力できる URL を列挙する。
fn enumerate_routes(routes_dir: &Path) -> Result<Vec<String>> {
    let mut urls = Vec::new();
    if !routes_dir.is_dir() {
        return Ok(urls);
    }
    for path in walk(routes_dir)? {
        let Ok(rel) = path.strip_prefix(routes_dir) else {
            continue;
        };
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        let Some(stem) = rel_str.strip_suffix(".js") else {
            continue;
        };
        // 静的化対象外: api ルート、動的 [param]、規約ファイル（_layout/_middleware/_404/...）
        if stem.starts_with("api/")
            || stem.contains('[')
            || stem.split('/').any(|seg| seg.starts_with('_'))
        {
            continue;
        }
        let url = if stem == "index" {
            "/".to_string()
        } else if let Some(dir) = stem.strip_suffix("/index") {
            format!("/{dir}")
        } else {
            format!("/{stem}")
        };
        urls.push(url);
    }
    urls.sort();
    Ok(urls)
}

/// URL を出力ファイルパスへ。`/` → index.html、`/about` → about/index.html（クリーンURL）。
fn out_file_for(out: &Path, url: &str) -> PathBuf {
    if url == "/" {
        out.join("index.html")
    } else {
        out.join(format!("{}/index.html", url.trim_start_matches('/')))
    }
}

fn walk(dir: &Path) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() {
            out.extend(walk(&path)?);
        } else {
            out.push(path);
        }
    }
    Ok(out)
}

fn copy_dir(from: &Path, to: &Path) -> Result<()> {
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let src = entry.path();
        let dst = to.join(entry.file_name());
        if src.is_dir() {
            std::fs::create_dir_all(&dst)?;
            copy_dir(&src, &dst)?;
        } else {
            std::fs::copy(&src, &dst)?;
        }
    }
    Ok(())
}
