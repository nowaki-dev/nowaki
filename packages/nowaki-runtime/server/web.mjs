// Web 標準（fetch / Request / Response）のリクエストハンドラ工場。Edge（Cloudflare Workers
// 等）向け。node:http も実行時ファイル import も使わない。ルート/島/manifest は
// ビルド時に静的 import 済みのマップとして渡される（worker は全モジュールをバンドルする）。
//
// 共有ロジックは handler.mjs（runtime 非依存）と document.mjs（純粋文字列）に集約済み。

import { h, options } from "preact";
import { handleRequest } from "./handler.mjs";
import { stableStringify } from "./serialize.mjs";
import { prodDocument, prodShell } from "./document.mjs";

// handler.mjs の結果 {status,headers,body,stream} を Web Response へ。
export function resultToResponse(result) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(result.headers ?? {})) {
    if (Array.isArray(v)) {
      for (const item of v) headers.append(k, String(item));
    } else if (v !== undefined && v !== null) {
      headers.set(k, String(v));
    }
  }
  const body = result.stream ?? result.body ?? "";
  return new Response(body, { status: result.status ?? 200, headers });
}

// 描画中の island を <nowaki-island> で包む options.vnode フックを差し込む（1回）。
function installIslandHook(registry) {
  const prev = options.vnode;
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
    if (prev) prev(vnode);
  };
}

/// Edge 用の fetch ハンドラを作る。
///   manifest         : クライアント manifest（islands/runtime/preload）
///   modules          : ルートテーブルの file キー → 静的 import 済みモジュール名前空間
///   islandComponents : island 名 → コンポーネント実体（default export）
///   routeTable       : scanRoutes 相当（file は modules のキー）
/// 返り値は `(request) => Promise<Response>`。
export function createFetchHandler({
  manifest,
  modules,
  islandComponents,
  routeTable,
  serverFunctions: serverFnTable,
}) {
  const registry = new Map();
  for (const [name, comp] of Object.entries(islandComponents ?? {})) {
    if (typeof comp === "function") {
      registry.set(comp, { name, src: `/_nowaki/${manifest.islands?.[name] ?? ""}` });
    }
  }
  installIslandHook(registry);

  // サーバー関数（`"use server"`）: id→{module,export} を静的 import 済み modules で引く。
  const serverFunctions =
    serverFnTable && Object.keys(serverFnTable).length
      ? {
          lookup: (id) => serverFnTable[id] ?? null,
          importModule: (key) => modules[key],
        }
      : null;

  const env = {
    dev: false,
    routeTable: () => routeTable,
    importModule: (key) => modules[key],
    ensureIslands: () => {},
    serverFunctions,
    renderDocument: (args) => prodDocument(manifest, args),
    renderShell: ({ mod }) => prodShell(manifest, mod),
    renderError: (err) => ({
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: String(err?.stack ?? err),
    }),
  };

  return async (request) => {
    const url = new URL(request.url);
    const headers = {};
    for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;
    const result = await handleRequest(env, {
      method: request.method,
      url,
      version: "prod",
      headers,
      readBody: async () => new Uint8Array(await request.arrayBuffer()),
    });
    return resultToResponse(result);
  };
}
