// 本番アプリの中核。`nowaki start`（start.mjs）と、各デプロイアダプタが出力する
// 自己完結エントリ（dist/server/index.mjs）が共有する。
// clientDir / serverDir を引数で受けるので、cwd にも import.meta の位置にも縛られない。
//
// 役割: dist/client を /_nowaki/ で静的配信し、dist/server の built ルートで prod SSR。
// ルーティング/レイアウト/middleware/loader/action/404/500 は handler.mjs に集約。
// Rust の dev サーバーには依存しない（自己完結）。

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { h, options } from "preact";
import { loadEnv } from "./env.mjs";
import { stableStringify } from "./serialize.mjs";
import { scanRoutes } from "./router.mjs";
import { handleRequest, sendResult } from "./handler.mjs";

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

/// 本番アプリを組み立てる。`clientDir`（dist/client）と `serverDir`（dist/server）を渡す。
/// 返り値の `handle(req, res)` は node:http 互換ハンドラ（Bun/Deno の node 互換でも動く）。
export async function createApp({ clientDir, serverDir, loadDotenv = true } = {}) {
  if (!clientDir || !serverDir) {
    throw new Error("createApp には clientDir と serverDir が必要です");
  }
  if (loadDotenv) loadEnv();

  const manifest = JSON.parse(await readFile(path.join(clientDir, "manifest.json"), "utf8"));

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

  // 描画中の island を <nowaki-island> でラップ（manifest のハッシュ名を src に）
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
            props: stableStringify(rest),
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
    renderDocument: (args) => prodDocument(manifest, args),
    renderShell: ({ mod }) => prodShell(manifest, mod),
    renderError: (err) => {
      console.error("[nowaki]", err);
      return {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: String(err?.stack ?? err),
      };
    },
  };

  // node:http 互換のリクエストハンドラ
  const handle = async (req, res) => {
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
      console.error("[nowaki]", err);
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(String(err?.stack ?? err));
    }
  };

  return { handle, env, manifest };
}

/// node:http でリッスンする。アダプタ/`nowaki start` の共通ランチャ。
/// 配備物（dist/server/index.mjs）は host=0.0.0.0 でコンテナから到達可能にする。
export async function startServer({
  clientDir,
  serverDir,
  port = Number(process.env.PORT ?? 3000),
  host = process.env.NOWAKI_HOST ?? "0.0.0.0",
} = {}) {
  const app = await createApp({ clientDir, serverDir });
  const server = createServer(app.handle);
  await new Promise((resolve) => {
    server.listen(port, host, () => {
      // PORT=0 のときは実際に割り当てられたポートを報告する（prerender 等が利用）
      const actual = server.address().port;
      console.log(`NOWAKI_START_READY ${actual}`);
      console.log(`[nowaki] 本番配信: http://${host}:${actual}`);
      resolve();
    });
  });
  return { server, app };
}

// 描画済み body を完成 HTML に包む（prod 用: modulepreload + runtime、島なしなら JS ゼロ）。
function prodDocument(manifest, { mod, body }) {
  const islandNames = [...body.matchAll(/<nowaki-island name="([^"]+)"/g)].map((m) => m[1]);
  const hasIslands = islandNames.length > 0 && manifest.runtime;
  // エントリチャンク（runtime + 使用 island）とその推移的依存をまとめて preload する。
  const preloadFiles = [];
  if (hasIslands) {
    const entryChunks = [
      manifest.runtime,
      ...islandNames.map((n) => manifest.islands?.[n]).filter(Boolean),
    ];
    const seen = new Set();
    for (const chunk of entryChunks) {
      if (!seen.has(chunk)) {
        seen.add(chunk);
        preloadFiles.push(chunk);
      }
      for (const dep of manifest.preload?.[chunk] ?? []) {
        if (!seen.has(dep)) {
          seen.add(dep);
          preloadFiles.push(dep);
        }
      }
    }
  }
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

// ストリーミング SSR 用の head（…<body>）と tail（runtime script…）。
// シェル送出時点で島が未確定なので、per-island preload は省き runtime チャンクだけ preload する
// （runtime が <nowaki-island> を見て各島チャンクを取得する）。
function prodShell(manifest, mod) {
  const runtimeChunk = manifest.runtime;
  const runtimePreload = runtimeChunk
    ? `<link rel="modulepreload" href="/_nowaki/${runtimeChunk}" />\n`
    : "";
  const runtimeScript = runtimeChunk
    ? `<script type="module" src="/_nowaki/${runtimeChunk}"></script>`
    : "";
  const head = `<!DOCTYPE html>
<html lang="${typeof mod.lang === "string" ? mod.lang : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(mod.title ?? "Nowaki App")}</title>
${runtimePreload}${typeof mod.head === "string" ? mod.head : ""}
</head>
<body>
`;
  const tail = `
${runtimeScript}
</body>
</html>`;
  return { head, tail };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
