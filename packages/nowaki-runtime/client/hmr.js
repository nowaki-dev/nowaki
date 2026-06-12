// HMRクライアント + エラーオーバーレイ (dev)。
// islands/ の変更は島だけをホットスワップ（"update"）、それ以外はフルリロード（"reload"）。
// 注: 現状の update は島モジュールを再importして再renderするため、コンポーネントの
// ローカルstateはリセットされる（prefresh相当のstate保持は将来対応）。

import { h, render } from "preact";

const OVERLAY_ID = "__nowaki_error_overlay";

/// islands/ 配下が変更されたとき、各 <nowaki-island> を再importして再renderする。
async function hotUpdateIslands() {
  const version = Date.now();
  for (const el of document.querySelectorAll("nowaki-island")) {
    const rawSrc = el.getAttribute("src");
    if (!rawSrc) continue;
    const props = JSON.parse(el.getAttribute("props") || "{}");
    const sep = rawSrc.includes("?") ? "&" : "?";
    const src = `${rawSrc}${sep}v=${version}`;
    try {
      const mod = await import(src);
      render(h(mod.default, props), el);
    } catch (err) {
      console.error(`[nowaki] island再読み込み失敗 ${rawSrc}:`, err);
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
  );
}

function showOverlay(message) {
  let el = document.getElementById(OVERLAY_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.setAttribute(
      "style",
      [
        "position:fixed",
        "inset:0",
        "z-index:2147483647",
        "background:rgba(8,10,16,0.94)",
        "color:#e6e6e6",
        "font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace",
        "padding:2.5rem 2rem",
        "overflow:auto",
      ].join(";"),
    );
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<div style="max-width:920px;margin:0 auto">' +
    '<div style="color:#ff6b6b;font-weight:700;font-size:15px;margin-bottom:1rem">Nowaki — build error</div>' +
    '<pre style="white-space:pre-wrap;margin:0;color:#e6e6e6">' +
    escapeHtml(message) +
    "</pre>" +
    '<div style="margin-top:1.5rem;color:#8a8f98">Fix the error and save. This clears on the next successful build.</div>' +
    "</div>";
}

function clearOverlay() {
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.remove();
}

const ws = new WebSocket(`ws://${location.host}/__nowaki/hmr`);

ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "error") {
    showOverlay(msg.message);
  } else if (msg.type === "update") {
    clearOverlay();
    hotUpdateIslands();
  } else if (msg.type === "reload") {
    clearOverlay();
    location.reload();
  }
});

ws.addEventListener("close", () => {
  // devサーバー再起動を待って再接続する
  const timer = setInterval(async () => {
    try {
      await fetch("/", { method: "HEAD" });
      clearInterval(timer);
      location.reload();
    } catch {
      // まだ落ちている
    }
  }, 500);
});
