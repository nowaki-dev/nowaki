//! プラグインホスト連携。`nowaki.config.{mjs,js}` があれば Node のプラグインホストを起動し、
//! その transform フックを nowaki-core の `PluginBridge` 経由で dev/build に注入する。
//! nowaki-core は JS を実行しないので、変換は HTTP でこのホストへ委譲する。
//!
//! 通信は localhost への素朴な HTTP/1.1（自前 TcpStream）。reqwest::blocking を使うと
//! tokio ランタイム内（dev）でランタイム衝突を起こすため、ランタイム非依存にしている。

use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use nowaki_core::PluginBridge;

/// Node プラグインホストへ `transform` / `.tsrx` コンパイルを委譲する PluginBridge 実装。
struct HttpPluginBridge {
    port: u16,
}

impl HttpPluginBridge {
    fn call(&self, path: &str, id: &str, code: &str) -> Option<String> {
        let body = serde_json::json!({ "id": id, "code": code }).to_string();
        let resp = http_post(self.port, path, &body).ok()?;
        let v: serde_json::Value = serde_json::from_str(&resp).ok()?;
        // {code: "..."} なら結果、{code: null} なら未変更/未対応。
        v.get("code")
            .and_then(|c| c.as_str())
            .map(|s| s.to_string())
    }
}

impl PluginBridge for HttpPluginBridge {
    fn transform(&self, id: &str, code: &str) -> Option<String> {
        self.call("/transform", id, code)
    }
    fn compile_tsrx(&self, id: &str, code: &str) -> Option<String> {
        self.call("/tsrx", id, code)
    }
}

/// 起動中のプラグインホスト。drop で子プロセスを落とす。
pub struct PluginHost {
    child: Child,
    pub bridge: Arc<dyn PluginBridge>,
}

impl Drop for PluginHost {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// nowaki.config があり transform フックを持つならプラグインホストを起動してブリッジを返す。
/// 設定が無い / フックが無い / ランタイム未導入なら None（＝オーバーヘッドゼロ）。
pub fn start(root: &Path) -> Result<Option<PluginHost>> {
    let has_config = ["nowaki.config.mjs", "nowaki.config.js"]
        .iter()
        .any(|n| root.join(n).exists());
    // @tsrx/preact があれば設定が無くても .tsrx のためにホストを起動する。
    let has_tsrx = root.join("node_modules/@tsrx/preact").is_dir();
    if !has_config && !has_tsrx {
        return Ok(None);
    }
    let script = root.join("node_modules/@nowaki-dev/runtime/server/plugin-host.mjs");
    if !script.exists() {
        eprintln!(
            "[nowaki] nowaki.config はあるが @nowaki-dev/runtime が無くプラグインを読み込めません"
        );
        return Ok(None);
    }

    let mut child = Command::new("node")
        .arg(&script)
        .current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .context("plugin host (node) の起動に失敗")?;

    let stdout = child.stdout.take().expect("piped stdout");
    let mut reader = BufReader::new(stdout);
    let mut port = None;
    let mut line = String::new();
    loop {
        line.clear();
        if reader.read_line(&mut line)? == 0 {
            break;
        }
        if let Some(rest) = line.trim().strip_prefix("NOWAKI_PLUGIN_HOST_READY ") {
            port = Some(rest.parse::<u16>().context("ポート解析失敗")?);
            break;
        }
    }
    let port = port.ok_or_else(|| anyhow!("plugin host が READY を報告しませんでした"))?;

    // transform フックも tsrx も無ければブリッジは不要（ホストは落とす）。
    let caps_body = http_get(port, "/caps")?;
    let caps: serde_json::Value = serde_json::from_str(&caps_body).unwrap_or_default();
    let cap = |k: &str| caps.get(k).and_then(|b| b.as_bool()).unwrap_or(false);
    let has_transform = cap("hasTransform");
    let has_tsrx = cap("hasTsrx");
    if !has_transform && !has_tsrx {
        let _ = child.kill();
        let _ = child.wait();
        return Ok(None);
    }

    let bridge: Arc<dyn PluginBridge> = Arc::new(HttpPluginBridge { port });
    let mut feats = Vec::new();
    if has_transform {
        feats.push("transform フック");
    }
    if has_tsrx {
        feats.push(".tsrx (@tsrx/preact)");
    }
    println!(
        "[nowaki] プラグインを読み込みました（{}）",
        feats.join(" + ")
    );
    Ok(Some(PluginHost { child, bridge }))
}

// --- 最小 HTTP/1.1（localhost, Connection: close でボディは EOF まで） ---

fn http_post(port: u16, path: &str, body: &str) -> Result<String> {
    request(port, "POST", path, Some(body))
}

fn http_get(port: u16, path: &str) -> Result<String> {
    request(port, "GET", path, None)
}

fn request(port: u16, method: &str, path: &str, body: Option<&str>) -> Result<String> {
    let mut stream = TcpStream::connect(("127.0.0.1", port))?;
    let body = body.unwrap_or("");
    let req = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(req.as_bytes())?;
    let mut resp = String::new();
    stream.read_to_string(&mut resp)?;
    Ok(resp
        .split_once("\r\n\r\n")
        .map(|(_, b)| b.to_string())
        .unwrap_or_default())
}
