// 本番配信サーバー。`nowaki start` から cwd=アプリルートで起動される。
// dist/client/ を /_nowaki/ で静的配信し、dist/server/ の built ルートで prod SSR。
// dev の sidecar.mjs と違い Rust devサーバーには依存しない（自己完結）。

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { h, options } from "preact";
import { renderToStringAsync } from "preact-render-to-string";

const { scanRoutes, matchRoute } = await import("./router.mjs");

const appRoot = process.cwd();
const clientDir = path.join(appRoot, "dist/client");
const serverDir = path.join(appRoot, "dist/server");
const PORT = Number(process.env.PORT ?? 3000);

const manifest = JSON.parse(
  await readFile(path.join(clientDir, "manifest.json"), "utf8"),
);

// island登録: コンポーネント実体 → { name, src(クライアントの静的URL) }。
// dist/server/islands の同一ファイルをルートも import するため、Nodeのモジュール
// キャッシュにより実体（default関数）が一致し、vnodeフックで検出できる。
const registry = new Map();
for (const [name, file] of Object.entries(manifest.islands ?? {})) {
  const mod = await import(
    pathToFileURL(path.join(serverDir, "islands", `${name}.js`)).href
  );
  if (typeof mod.default === "function") {
    registry.set(mod.default, { name, src: `/_nowaki/${file}` });
  }
}

// 描画中の island を <nowaki-island> でラップ（prod用、manifestのハッシュ名をsrcに）
const prevVnode = options.vnode;
options.vnode = (vnode) => {
  if (
    typeof vnode.type === "function" &&
    registry.has(vnode.type) &&
    !vnode.props.__nowakiInner
  ) {
    const island = registry.get(vnode.type);
    const Original = vnode.type;
    vnode.type = (props) => {
      const { __nowakiInner, ...rest } = props;
      return h(
        "nowaki-island",
        {
          name: island.name,
          src: island.src,
          props: JSON.stringify(rest),
          style: "display:contents",
        },
        h(Original, { ...rest, __nowakiInner: true }),
      );
    };
  }
  if (prevVnode) prevVnode(vnode);
};

const routes = await scanRoutes(serverDir);

const CONTENT_TYPE = {
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  map: "application/json",
  css: "text/css; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    // 静的アセット配信（/_nowaki/<hashed>）
    if (url.pathname.startsWith("/_nowaki/")) {
      const name = path.basename(url.pathname); // basename化でtraversal防止
      try {
        const data = await readFile(path.join(clientDir, name));
        const ext = name.split(".").pop();
        res.writeHead(200, {
          "content-type": CONTENT_TYPE[ext] ?? "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
        });
        res.end(data);
      } catch {
        res.writeHead(404).end("not found");
      }
      return;
    }

    const match = matchRoute(routes, url.pathname);
    if (!match) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("<h1>404 Not Found</h1>");
      return;
    }

    const mod = await import(pathToFileURL(match.file).href);

    if (match.isApi) {
      const result = await mod.default({
        url,
        params: match.params,
        method: req.method,
      });
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

    const Page = mod.default;
    const data = mod.loader
      ? await mod.loader({ url, params: match.params })
      : undefined;
    const body = await renderToStringAsync(
      h(Page, { data, params: match.params, url }),
    );
    const runtime = manifest.runtime
      ? `<script type="module" src="/_nowaki/${manifest.runtime}"></script>`
      : "";

    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html lang="${typeof mod.lang === "string" ? mod.lang : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(mod.title ?? "Nowaki App")}</title>
${typeof mod.head === "string" ? mod.head : ""}
</head>
<body>
${body}
${runtime}
</body>
</html>`);
  } catch (err) {
    console.error("[nowaki start]", err);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(err?.stack ?? err));
  }
});

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`NOWAKI_START_READY ${PORT}`);
  console.log(`[nowaki] 本番配信: http://127.0.0.1:${PORT}`);
});
