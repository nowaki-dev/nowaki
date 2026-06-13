// SSRサイドカー。Rust devサーバーから起動され、ページ描画とAPIルートを担当する。
// 起動完了は stdout の "NOWAKI_SIDECAR_READY <port>" でRustへ通知する。
// ルーティング/レイアウト/ミドルウェア/loader/action/404/500 は handler.mjs に集約。

import { createServer } from "node:http";
import { register } from "node:module";
import { loadEnv } from "./env.mjs";

// .env を process.env に読み込む（ルート/loader が読めるように、ルート読込より前に）
loadEnv();

// 以降のdynamic importする .tsx/.ts はRustの変換エンドポイント経由で読み込まれる
register(new URL("./loader-hooks.mjs", import.meta.url));

const { scanRoutes } = await import("./router.mjs");
const { loadIslandRegistry, renderDocument, renderShell, errorPage } = await import("./render.mjs");
const { handleRequest, sendResult } = await import("./handler.mjs");
const { liveRender } = await import("./live.mjs");
const { pathToFileURL } = await import("node:url");

const appRoot = process.cwd();

const env = {
  dev: true,
  // dev は毎リクエスト再スキャン（ファイル変更を反映）
  routeTable: () => scanRoutes(appRoot),
  importModule: (file, version) => import(`${pathToFileURL(file).href}?v=${version}`),
  ensureIslands: (version) => loadIslandRegistry(appRoot, version),
  renderDocument,
  renderShell,
  renderError: (err) => {
    console.error("[nowaki ssr]", err);
    return {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: errorPage(String(err?.stack ?? err)),
    };
  },
};

const server = createServer(async (req, res) => {
  // サーバーリアクティブ島の再描画（Rust の /__nowaki/live WS から呼ばれる）。
  if (req.method === "POST" && req.url.startsWith("/__nowaki/live-render")) {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const { name, state, handler, payload, version } = JSON.parse(
        Buffer.concat(chunks).toString("utf8"),
      );
      const reg = await loadIslandRegistry(appRoot, String(version ?? "0"));
      const entry = [...reg.values()].find((e) => e.name === name);
      if (!entry?.live) {
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
    const version = String(req.headers["x-nowaki-ssr-version"] ?? "0");
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const result = await handleRequest(env, {
      method: req.method,
      url,
      version,
      req,
    });
    await sendResult(res, result);
  } catch (err) {
    console.error("[nowaki ssr]", err);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end(errorPage(String(err?.stack ?? err)));
  }
});

server.listen(0, "127.0.0.1", () => {
  console.log(`NOWAKI_SIDECAR_READY ${server.address().port}`);
});
