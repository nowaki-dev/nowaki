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
import { wrapIsland } from "./island-directive.mjs";
import { scanRoutes } from "./router.mjs";
import { handleRequest, sendResult } from "./handler.mjs";
import { prodDocument, prodShell } from "./document.mjs";
import { liveInitialState } from "./live.mjs";
import { liveProps } from "./live-sign.mjs";

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

  // ライブ島（サーバーリアクティブ）レジストリ: コンポーネント → { name, mod, live }。
  // クライアントへ JS は送らない（live.js が <nowaki-live> を WS で更新する）。
  const liveRegistry = new Map();
  let liveCounter = 0;
  for (const name of manifest.liveIslands ?? []) {
    const mod = await import(
      pathToFileURL(path.join(serverDir, "islands", `${name}.js`)).href
    );
    if (typeof mod.default === "function") {
      liveRegistry.set(mod.default, { name, mod, live: mod.live });
    }
  }

  // 描画中の island をラップ。ライブ島は <nowaki-live>、通常島は <nowaki-island>。
  const prevVnode = options.vnode;
  options.vnode = (vnode) => {
    if (
      typeof vnode.type === "function" &&
      !vnode.props.__nowakiInner &&
      !vnode.props.__nowakiLiveInner
    ) {
      const Original = vnode.type;
      if (liveRegistry.has(vnode.type)) {
        const info = liveRegistry.get(vnode.type);
        vnode.type = (props) => {
          const { state: propState, ...rest } = props;
          const state = propState ?? liveInitialState(info.mod, rest);
          const nid = `L${liveCounter++}`;
          // liveProps が初期 state を HMAC 署名する（dev/prod 共通。prod で署名漏れ＝
          // verify 必失敗でライブ島が死ぬのを防ぐため render.mjs と同じヘルパーを使う）。
          return h(
            "nowaki-live",
            liveProps(info.name, nid, state),
            h(Original, { state, __nowakiLiveInner: true }),
          );
        };
      } else if (registry.has(vnode.type)) {
        const island = registry.get(vnode.type);
        vnode.type = (props) => wrapIsland(island, props, Original);
      }
    }
    if (prevVnode) prevVnode(vnode);
  };

  // ルートテーブルは起動時に1回スキャン（built dist/server/routes）。
  const routeTable = await scanRoutes(serverDir);

  // サーバー関数（`"use server"`）の allowlist。dist/server/functions.json（build が生成）。
  let serverFnTable = {};
  try {
    serverFnTable = JSON.parse(await readFile(path.join(serverDir, "functions.json"), "utf8"));
  } catch {
    // functions.json が無ければサーバー関数なし（機能オフ）。
  }
  const serverFunctions = Object.keys(serverFnTable).length
    ? {
        lookup: (id) => serverFnTable[id] ?? null,
        importModule: (m) => import(pathToFileURL(path.join(serverDir, m)).href),
      }
    : null;

  const env = {
    dev: false,
    routeTable: () => routeTable,
    importModule: (file) => import(pathToFileURL(file).href),
    ensureIslands: () => {}, // レジストリは起動時に構築済み
    serverFunctions,
    renderDocument: (args) => prodDocument(manifest, args),
    renderShell: ({ mod, meta }) => prodShell(manifest, mod, meta),
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

  return { handle, env, manifest, liveRegistry };
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
