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
const { loadIslandRegistry, renderDocument, errorPage } = await import("./render.mjs");
const { handleRequest, sendResult } = await import("./handler.mjs");
const { pathToFileURL } = await import("node:url");

const appRoot = process.cwd();

const env = {
  dev: true,
  // dev は毎リクエスト再スキャン（ファイル変更を反映）
  routeTable: () => scanRoutes(appRoot),
  importModule: (file, version) => import(`${pathToFileURL(file).href}?v=${version}`),
  ensureIslands: (version) => loadIslandRegistry(appRoot, version),
  renderDocument,
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
