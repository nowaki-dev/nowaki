// SSRサイドカー。Rust devサーバーから起動され、ページ描画とAPIルートを担当する。
// 起動完了は stdout の "NOWAKI_SIDECAR_READY <port>" でRustへ通知する。

import { createServer } from "node:http";
import { register } from "node:module";
import { loadEnv } from "./env.mjs";

// .env を process.env に読み込む（ルート/loader が読めるように、ルート読込より前に）
loadEnv();

// 以降のdynamic importする .tsx/.ts はRustの変換エンドポイント経由で読み込まれる
register(new URL("./loader-hooks.mjs", import.meta.url));

const { scanRoutes, matchRoute } = await import("./router.mjs");
const { loadIslandRegistry, renderPage, errorPage } = await import("./render.mjs");
const { pathToFileURL } = await import("node:url");

const appRoot = process.cwd();

const server = createServer(async (req, res) => {
  try {
    const version = String(req.headers["x-nowaki-ssr-version"] ?? "0");
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    const routes = await scanRoutes(appRoot);
    const match = matchRoute(routes, url.pathname);
    if (!match) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("<h1>404 Not Found</h1>");
      return;
    }

    const mod = await import(`${pathToFileURL(match.file).href}?v=${version}`);

    if (match.isApi) {
      const handler = mod.default;
      const result = await handler({ url, params: match.params, method: req.method });
      res.writeHead(result?.status ?? 200, {
        "content-type": "application/json; charset=utf-8",
        ...(result?.headers ?? {}),
      });
      res.end(
        typeof result?.body === "string"
          ? result.body
          : JSON.stringify(result?.body ?? null),
      );
      return;
    }

    await loadIslandRegistry(appRoot, version);
    const html = await renderPage(mod, { url, params: match.params });
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (err) {
    console.error("[nowaki ssr]", err);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end(errorPage(String(err?.stack ?? err)));
  }
});

server.listen(0, "127.0.0.1", () => {
  console.log(`NOWAKI_SIDECAR_READY ${server.address().port}`);
});
