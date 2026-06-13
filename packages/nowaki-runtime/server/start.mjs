// 本番配信サーバー。`nowaki start` から cwd=アプリルートで起動される。
// dist/client/ を /_nowaki/ で静的配信し、dist/server/ の built ルートで prod SSR。
// dev の sidecar.mjs と違い Rust devサーバーには依存しない（自己完結）。
// ルーティング/レイアウト/ミドルウェア/loader/action/404/500 は handler.mjs に集約。

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { h, options } from "preact";
import { loadEnv } from "./env.mjs";

loadEnv();

const { scanRoutes } = await import("./router.mjs");
const { handleRequest, sendResult } = await import("./handler.mjs");

const appRoot = process.cwd();
const clientDir = path.join(appRoot, "dist/client");
const serverDir = path.join(appRoot, "dist/server");
const PORT = Number(process.env.PORT ?? 3000);

const manifest = JSON.parse(
  await readFile(path.join(clientDir, "manifest.json"), "utf8"),
);

// island登録: コンポーネント実体 → { name, src(クライアントの静的URL) }。
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

// ルートテーブルは起動時に1回スキャン（built dist/server/routes）。
const routeTable = await scanRoutes(serverDir);

const env = {
  dev: false,
  routeTable: () => routeTable,
  importModule: (file) => import(pathToFileURL(file).href),
  ensureIslands: () => {}, // レジストリは起動時に構築済み
  renderDocument: prodDocument,
  renderError: (err) => {
    console.error("[nowaki start]", err);
    return {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: String(err?.stack ?? err),
    };
  },
};

const CONTENT_TYPE = {
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  map: "application/json",
  css: "text/css; charset=utf-8",
  // アセット（import 経由でハッシュ付き出力される）
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  pdf: "application/pdf",
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

    const result = await handleRequest(env, {
      method: req.method,
      url,
      version: "prod",
      req,
    });
    await sendResult(res, result);
  } catch (err) {
    console.error("[nowaki start]", err);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(err?.stack ?? err));
  }
});

// 描画済み body を完成 HTML に包む（prod 用: modulepreload + runtime、島なしなら JS ゼロ）。
function prodDocument({ mod, body }) {
  const islandNames = [...body.matchAll(/<nowaki-island name="([^"]+)"/g)].map(
    (m) => m[1],
  );
  const hasIslands = islandNames.length > 0 && manifest.runtime;
  const preloadFiles = hasIslands
    ? [
        ...new Set([
          manifest.runtime,
          ...islandNames.map((n) => manifest.islands?.[n]).filter(Boolean),
        ]),
      ]
    : [];
  const preload = preloadFiles
    .map((f) => `<link rel="modulepreload" href="/_nowaki/${f}" />`)
    .join("\n");
  const runtime = hasIslands
    ? `<script type="module" src="/_nowaki/${manifest.runtime}"></script>`
    : "";

  return `<!DOCTYPE html>
<html lang="${typeof mod.lang === "string" ? mod.lang : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(mod.title ?? "Nowaki App")}</title>
${preload}
${typeof mod.head === "string" ? mod.head : ""}
</head>
<body>
${body}
${runtime}
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

server.listen(PORT, "127.0.0.1", () => {
  // PORT=0 のときは実際に割り当てられたポートを報告する（prerender 等が利用）
  const actual = server.address().port;
  console.log(`NOWAKI_START_READY ${actual}`);
  console.log(`[nowaki] 本番配信: http://127.0.0.1:${actual}`);
});
