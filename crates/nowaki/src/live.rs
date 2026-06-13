//! サーバーリアクティブ島（Jetstream）の WS セッション。dev/prod 共通。
//!
//! Rust が `/__nowaki/live` の WebSocket を保持し、接続ごとに nid→(name, state) を持つ。
//! クライアントの "event" を Node サイドカーの `/__nowaki/live-render` へ橋渡しし、
//! 返ってきた新 state を保持・新 html を `patch` としてクライアントへ push する。
//! 状態は Rust 側（このプロセス・この接続）にあり、Node は純粋な再評価関数。

use std::collections::HashMap;

use axum::extract::ws::{Message, WebSocket};
use serde_json::{json, Value};

pub async fn handle(
    mut socket: WebSocket,
    http: reqwest::Client,
    sidecar_port: u16,
    version: String,
) {
    // nid -> (island name, 現在の state)
    let mut islands: HashMap<String, (String, Value)> = HashMap::new();

    while let Some(Ok(msg)) = socket.recv().await {
        let Message::Text(txt) = msg else { continue };
        let Ok(v) = serde_json::from_str::<Value>(txt.as_str()) else {
            continue;
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
                        islands.insert(nid.to_string(), (name, st));
                    }
                }
            }
            Some("event") => {
                let nid = v
                    .get("nid")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();
                let Some((name, st)) = islands.get(&nid).cloned() else {
                    continue;
                };
                let body = json!({
                    "name": name,
                    "state": st,
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
                    continue;
                };
                let Ok(txt) = r.text().await else { continue };
                let Ok(rv) = serde_json::from_str::<Value>(&txt) else {
                    continue;
                };
                if let Some(ns) = rv.get("state") {
                    islands.insert(nid.clone(), (name, ns.clone()));
                }
                let html = rv.get("html").and_then(|h| h.as_str()).unwrap_or("");
                let patch = json!({ "type": "patch", "nid": nid, "html": html });
                if socket
                    .send(Message::Text(patch.to_string().into()))
                    .await
                    .is_err()
                {
                    break;
                }
            }
            _ => {}
        }
    }
}
