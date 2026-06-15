//! サーバーリアクティブ島（Jetstream）の WS セッション。dev/prod 共通。
//!
//! Rust が `/__nowaki/live` の WebSocket を保持し、接続ごとに nid→(name, state) を持つ。
//! クライアントの "event" を Node サイドカーの `/__nowaki/live-render` へ橋渡しし、
//! 返ってきた新 state を保持・新 html を `patch` としてクライアントへ push する。
//! 状態は Rust 側（このプロセス・この接続）にあり、Node は純粋な再評価関数。
//!
//! 接続スケール: `LiveHub` が全接続を束ね、(1) 同時接続の上限、(2) presence（接続数）の
//! ブロードキャスト、(3) ハートビート（ping/pong + アイドルタイムアウト）でゾンビ接続を掃除する。

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::ws::{Message, WebSocket};
use serde_json::{json, Value};
use tokio::sync::broadcast;

/// ハートビート間隔とアイドルタイムアウト（pong/メッセージがこの間無ければ切断）。
const PING_INTERVAL: Duration = Duration::from_secs(30);
const IDLE_TIMEOUT: Duration = Duration::from_secs(75);

/// 全 Jetstream 接続を束ねるハブ（dev/prod に1つ）。接続数の上限と presence を管理する。
pub struct LiveHub {
    active: AtomicUsize,
    max: usize,
    presence: broadcast::Sender<usize>,
}

impl LiveHub {
    pub fn new() -> Arc<Self> {
        let max = std::env::var("NOWAKI_LIVE_MAX")
            .ok()
            .and_then(|s| s.parse().ok())
            .filter(|&n| n > 0)
            .unwrap_or(10_000);
        let (presence, _) = broadcast::channel(64);
        Arc::new(Self {
            active: AtomicUsize::new(0),
            max,
            presence,
        })
    }

    /// 接続を1つ受け入れる。上限超過なら None（呼び出し側が拒否する）。
    fn join(&self) -> Option<usize> {
        let prev = self.active.fetch_add(1, Ordering::SeqCst);
        if prev + 1 > self.max {
            self.active.fetch_sub(1, Ordering::SeqCst);
            return None;
        }
        let n = prev + 1;
        let _ = self.presence.send(n);
        Some(n)
    }

    fn leave(&self) {
        let prev = self.active.fetch_sub(1, Ordering::SeqCst);
        let _ = self.presence.send(prev.saturating_sub(1));
    }

    fn count(&self) -> usize {
        self.active.load(Ordering::SeqCst)
    }
}

pub async fn handle(
    mut socket: WebSocket,
    hub: Arc<LiveHub>,
    http: reqwest::Client,
    sidecar_port: u16,
    version: String,
) {
    // 上限超過なら丁重に断って閉じる（クライアントは初期 SSR のまま劣化動作）。
    let Some(count) = hub.join() else {
        let _ = socket
            .send(Message::Text(
                json!({ "type": "error", "reason": "at capacity" })
                    .to_string()
                    .into(),
            ))
            .await;
        let _ = socket.send(Message::Close(None)).await;
        return;
    };

    let mut presence_rx = hub.presence.subscribe();
    // 接続直後に現在の presence を送る。
    let _ = socket
        .send(Message::Text(
            json!({ "type": "presence", "count": count })
                .to_string()
                .into(),
        ))
        .await;

    // nid -> (island name, 現在の state, state の署名)
    let mut islands: std::collections::HashMap<String, (String, Value, String)> =
        std::collections::HashMap::new();
    let mut last_seen = Instant::now();
    let mut ping = tokio::time::interval(PING_INTERVAL);
    ping.tick().await; // 最初の即時 tick を捨てる

    loop {
        tokio::select! {
            incoming = socket.recv() => {
                let Some(Ok(msg)) = incoming else { break };
                last_seen = Instant::now(); // 任意の受信で生存更新（pong 含む）
                if let Message::Text(txt) = msg {
                    if !handle_text(&mut socket, &mut islands, &http, sidecar_port, &version, txt.as_str()).await {
                        break;
                    }
                }
                // Ping/Pong/Binary/Close は last_seen 更新のみ（Close は recv が None になる）。
            }
            // 他接続の presence 変化を転送する。
            p = presence_rx.recv() => {
                let n = match p {
                    Ok(n) => n,
                    Err(broadcast::error::RecvError::Lagged(_)) => hub.count(),
                    Err(broadcast::error::RecvError::Closed) => break,
                };
                if socket.send(Message::Text(json!({ "type": "presence", "count": n }).to_string().into())).await.is_err() {
                    break;
                }
            }
            // ハートビート: アイドル超過なら切断、さもなくば ping。
            _ = ping.tick() => {
                if last_seen.elapsed() > IDLE_TIMEOUT {
                    break;
                }
                if socket.send(Message::Ping(Vec::new().into())).await.is_err() {
                    break;
                }
            }
        }
    }

    hub.leave();
}

/// Text メッセージ（join/event）を処理する。接続継続なら true、切断すべきなら false。
async fn handle_text(
    socket: &mut WebSocket,
    islands: &mut std::collections::HashMap<String, (String, Value, String)>,
    http: &reqwest::Client,
    sidecar_port: u16,
    version: &str,
    txt: &str,
) -> bool {
    let Ok(v) = serde_json::from_str::<Value>(txt) else {
        return true;
    };
    match v.get("type").and_then(|t| t.as_str()) {
        Some("join") => {
            if let Some(arr) = v.get("islands").and_then(|i| i.as_array()) {
                for it in arr {
                    let nid = it.get("nid").and_then(|x| x.as_str()).unwrap_or("");
                    if nid.is_empty() {
                        continue;
                    }
                    let name = it
                        .get("name")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string();
                    let st = it.get("state").cloned().unwrap_or_else(|| json!({}));
                    // 初期 state の署名（SSR で発行）。サイドカーがハンドラ実行前に検証する。
                    let sig = it
                        .get("sig")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string();
                    islands.insert(nid.to_string(), (name, st, sig));
                }
            }
            true
        }
        Some("event") => {
            let nid = v
                .get("nid")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let Some((name, st, sig)) = islands.get(&nid).cloned() else {
                return true;
            };
            let body = json!({
                "name": name,
                "state": st,
                "sig": sig,
                "handler": v.get("handler"),
                "payload": v.get("payload"),
                "version": version,
            });
            let url = format!("http://127.0.0.1:{sidecar_port}/__nowaki/live-render");
            let resp = http
                .post(&url)
                .header("content-type", "application/json")
                .body(body.to_string())
                .send()
                .await;
            let Ok(r) = resp else {
                eprintln!("[nowaki live] サイドカー再描画に失敗");
                return true;
            };
            let Ok(txt) = r.text().await else { return true };
            let Ok(rv) = serde_json::from_str::<Value>(&txt) else {
                return true;
            };
            // 署名検証失敗などで html が無い（サイドカーがエラーを返した）場合は
            // state を更新せず patch も送らない（偽造 state を握らせない / 空描画を防ぐ）。
            let Some(html) = rv.get("html").and_then(|h| h.as_str()) else {
                return true;
            };
            // 新 state とその新しい署名を保持（次イベントで検証が続くように）。
            if let Some(ns) = rv.get("state") {
                let nsig = rv
                    .get("sig")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();
                islands.insert(nid.clone(), (name, ns.clone(), nsig));
            }
            let patch = json!({ "type": "patch", "nid": nid, "html": html });
            socket
                .send(Message::Text(patch.to_string().into()))
                .await
                .is_ok()
        }
        _ => true,
    }
}
