// HMRクライアント (MVP: live reload)。
// Phase 3 でモジュール単位の update + prefresh に置き換える。

const ws = new WebSocket(`ws://${location.host}/__nowaki/hmr`);

ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "reload") location.reload();
  if (msg.type === "error") console.error("[nowaki]", msg.message);
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
