use std::path::Path;
use std::process::Stdio;

use anyhow::{anyhow, Context, Result};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

/// SSRサイドカー (Nodeプロセス)。stdoutの READY 行からポートを得る。
pub struct Sidecar {
    pub port: u16,
    #[allow(dead_code)] // Dropでkillさせるために保持する
    child: Child,
}

pub async fn spawn(root: &Path, rust_port: u16) -> Result<Sidecar> {
    let entry = root.join("node_modules/@nowaki/runtime/server/sidecar.mjs");
    if !entry.exists() {
        return Err(anyhow!(
            "@nowaki/runtime が見つかりません ({}). アプリで `pnpm install` を実行してください",
            entry.display()
        ));
    }

    let mut child = Command::new("node")
        .arg(&entry)
        .current_dir(root)
        .env("NOWAKI_RUST_PORT", rust_port.to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .context("nodeの起動に失敗しました")?;

    let stdout = child.stdout.take().expect("piped stdout");
    let mut lines = BufReader::new(stdout).lines();
    let mut port = None;
    while let Some(line) = lines.next_line().await? {
        if let Some(rest) = line.strip_prefix("NOWAKI_SIDECAR_READY ") {
            port = Some(
                rest.trim()
                    .parse::<u16>()
                    .context("サイドカーのポートが不正です")?,
            );
            break;
        }
        println!("[sidecar] {line}");
    }
    let port = port.ok_or_else(|| anyhow!("サイドカーがREADYを報告せずに終了しました"))?;

    // 以降のstdoutはログとして流し続ける
    tokio::spawn(async move {
        while let Ok(Some(line)) = lines.next_line().await {
            println!("[sidecar] {line}");
        }
    });

    Ok(Sidecar { port, child })
}
