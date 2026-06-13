// 本番 SSR サイドカー。`nowaki start`（Rust axum フロント）から起動され、内部ポートで待つ。
// Rust が静的配信と HTML 組み立て（island 配線・preload）を担い、Node は「コンポーネント描画」だけ。
// そのため、ページルートは完成 HTML ではなく「描画済み body + メタ」を返す（Rust が組み立てる）。
// API/リダイレクト/ストリーミングは従来どおりの応答を返し、Rust はそのまま素通しする。
// 起動完了は stdout の "NOWAKI_START_READY <port>" で Rust へ通知する。

import { createServer } from "node:http";
import { Readable } from "node:stream";
import path from "node:path";
import { createApp } from "./app.mjs";
import { handleRequest } from "./handler.mjs";
import { liveRender } from "./live.mjs";
import { pageMeta } from "./document.mjs";

const appRoot = process.cwd();
const { env, liveRegistry } = await createApp({
  clientDir: path.join(appRoot, "dist/client"),
  serverDir: path.join(appRoot, "dist/server"),
});

// ページは完成 HTML ではなく body+メタのマーカーを返す（Rust 側で組み立てる）。
// ストリーミング（renderShell 経由）はマーカーを通らず stream 応答 → 素通し。
env.renderDocument = ({ mod, body, meta }) => {
  const m = pageMeta(meta, mod);
  return { __nowakiPage: true, body, title: m.title, head: m.head, lang: m.lang };
};

const server = createServer(async (req, res) => {
  // サーバーリアクティブ島の再描画（Rust の /__nowaki/live WS から呼ばれる）。
  if (req.method === "POST" && req.url.startsWith("/__nowaki/live-render")) {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const { name, state, handler, payload } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const entry = [...liveRegistry.values()].find((e) => e.name === name);
      if (!entry) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "live island not found" }));
        return;
      }
      const result = await liveRender(entry.mod, state, handler, payload);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error("[nowaki live]", err);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err?.stack ?? err) }));
    }
    return;
  }
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const result = await handleRequest(env, { method: req.method, url, version: "prod", req });
    const b = result.body;
    if (b && typeof b === "object" && b.__nowakiPage) {
      // ページ: body と meta を JSON で返す。Rust が doctype/head/preload/runtime を巻く。
      // （cookie 等の応答ヘッダは保ったまま、x-nowaki-page で Rust に「組み立てて」と伝える）
      res.writeHead(result.status ?? 200, {
        ...(result.headers ?? {}),
        "content-type": "application/json; charset=utf-8",
        "x-nowaki-page": "1",
      });
      res.end(JSON.stringify({ body: b.body, title: b.title, head: b.head, lang: b.lang }));
    } else {
      // 素通し: API / redirect / stream / streaming SSR / 組み込み 404・500。
      res.writeHead(result.status ?? 200, result.headers ?? {});
      if (result.stream) {
        Readable.fromWeb(result.stream).pipe(res);
      } else {
        res.end(result.body ?? "");
      }
    }
  } catch (err) {
    console.error("[nowaki prod-sidecar]", err);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(err?.stack ?? err));
  }
});

server.listen(0, "127.0.0.1", () => {
  console.log(`NOWAKI_START_READY ${server.address().port}`);
});
