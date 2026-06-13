// dev(sidecar.mjs) と prod(start.mjs) が共有するリクエストハンドラ。
// ルーティング・ミドルウェア・レイアウト・loader/action・404/500 をここに集約し、
// 環境差分（モジュールの読み込み方、島の解決、ドキュメント組み立て）は env で注入する。

import { Readable } from "node:stream";
import { h } from "preact";
import { renderToStringAsync } from "preact-render-to-string";
import { renderToReadableStream } from "preact-render-to-string/stream";

import { matchRoute } from "./router.mjs";
import { makeContext } from "./context.mjs";
import { dispatchServerFn, SERVER_FN_PATH } from "./functions.mjs";

// handleRequest の結果を Node のレスポンスへ書き出す（stream 対応）。
export async function sendResult(res, result) {
  res.writeHead(result.status ?? 200, result.headers ?? {});
  if (result.stream) {
    Readable.fromWeb(result.stream).pipe(res);
    return;
  }
  res.end(result.body ?? "");
}

const HTML = { "content-type": "text/html; charset=utf-8" };
const JSON_CT = { "content-type": "application/json; charset=utf-8" };

/// env が提供するもの:
///   routeTable(version) -> { routes, layouts, middleware, notFound, errorRoute }
///   importModule(file, version) -> モジュール
///   ensureIslands(version) -> 島レジストリを用意（描画前に呼ぶ）
///   renderDocument({ mod, body }) -> 完成 HTML 文字列
///   renderError(err) -> { status, headers, body }（dev/prod で表示が違う 500）
export async function handleRequest(env, info) {
  const { method, url, version } = info;
  const table = await env.routeTable(version);
  const match = matchRoute(table.routes, url.pathname);
  const ctx = makeContext({ ...info, params: match?.params ?? {} });

  // サーバー関数 RPC（`"use server"`）。ルーティングより前に処理する。
  if (env.serverFunctions && url.pathname === SERVER_FN_PATH) {
    return finalize(ctx, await dispatchServerFn(ctx, info, env.serverFunctions));
  }

  try {
    // 1. ミドルウェア（root → leaf）。Response を返したら短絡。
    const short = await runMiddleware(env, table, ctx, version);
    if (short) return finalize(ctx, short);

    // 2. 未一致 → 404 規約
    if (!match) return finalize(ctx, await render404(env, table, ctx, version));

    const mod = await env.importModule(match.file, version);

    // 3. API ルート（メソッド分岐 + Response/streaming 対応）
    if (match.isApi) return finalize(ctx, await handleApi(mod, ctx));

    // 4. action（非 GET/HEAD で action を持つ）
    if (method !== "GET" && method !== "HEAD" && typeof mod.action === "function") {
      const out = await mod.action(ctx);
      const res = toResult(out);
      if (res) return finalize(ctx, res); // Response/redirect を返したら確定
      ctx.actionData = out; // データならページ再描画へ
    }

    // 5. レイアウト + loader + ページ描画
    return finalize(ctx, await renderRoute(env, table, match, mod, ctx, version));
  } catch (err) {
    if (ctx._redirect) return finalize(ctx, ctx._redirect); // ctx.redirect() の throw 経路
    return finalize(ctx, await render500(env, table, ctx, version, err));
  }
}

// ctx に溜めた status / ヘッダ / Set-Cookie を結果へ反映する。
function finalize(ctx, result) {
  if (!result) return { status: 500, headers: HTML, body: "Internal Error" };
  const headers = { ...(result.headers ?? {}) };
  for (const [k, v] of ctx.resHeaders) {
    if (k.toLowerCase() === "set-cookie") continue;
    if (headers[k] === undefined) headers[k] = v;
  }
  const cookies = ctx.collectSetCookies();
  if (cookies.length) headers["set-cookie"] = cookies.length === 1 ? cookies[0] : cookies;
  let status = result.status ?? ctx.resStatus ?? 200;
  if (ctx.resStatus && (result.status === undefined || result.status === 200)) {
    status = ctx.resStatus;
  }
  return { status, headers, body: result.body, stream: result.stream };
}

// ミドルウェアを root→leaf で実行。Response 相当を返した時点で短絡。
async function runMiddleware(env, table, ctx, version) {
  for (const entry of table.middleware ?? []) {
    if (!underPrefix(ctx.url.pathname, entry.prefix)) continue;
    const mod = await env.importModule(entry.file, version);
    const fn = mod.default ?? mod.middleware;
    if (typeof fn !== "function") continue;
    const out = await fn(ctx);
    const res = toResult(out);
    if (res) return res;
  }
  return null;
}

async function handleApi(mod, ctx) {
  const fn = pickMethodHandler(mod, ctx.method);
  if (!fn) {
    return { status: 405, headers: JSON_CT, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }
  const out = await fn(ctx);
  const res = toResult(out);
  if (res) return res;
  // 旧式 { status, headers, body } もサポート
  if (out && typeof out === "object" && ("body" in out || "status" in out)) {
    return {
      status: out.status ?? 200,
      headers: { ...JSON_CT, ...(out.headers ?? {}) },
      body: typeof out.body === "string" ? out.body : JSON.stringify(out.body ?? null),
    };
  }
  return { status: 200, headers: JSON_CT, body: JSON.stringify(out ?? null) };
}

// default / GET / POST / ... のメソッド別 export を選ぶ。
function pickMethodHandler(mod, method) {
  const named = mod[method] ?? mod[method?.toLowerCase?.()];
  if (typeof named === "function") return named;
  if (typeof mod.default === "function") return mod.default;
  return null;
}

// レイアウト合成 + loader 実行 + ページ描画。
async function renderRoute(env, table, match, mod, ctx, version) {
  await env.ensureIslands(version);
  const Page = mod.default;
  if (typeof Page !== "function") {
    throw new Error(`ルートがコンポーネントを default export していません: ${ctx.url.pathname}`);
  }
  const data = mod.loader ? await mod.loader(ctx) : undefined;
  let node = h(Page, { data, actionData: ctx.actionData, params: ctx.params, url: ctx.url });

  // レイアウトを leaf→root で外側に巻く
  const layouts = layoutChain(table, match.file);
  for (let i = layouts.length - 1; i >= 0; i--) {
    const lmod = await env.importModule(layouts[i], version);
    const Layout = lmod.default;
    if (typeof Layout !== "function") continue;
    const ldata = lmod.loader ? await lmod.loader(ctx) : undefined;
    node = h(Layout, { data: ldata, params: ctx.params, url: ctx.url, children: node });
  }

  // ストリーミング SSR（ルートが `export const streaming = true` でオプトイン）。
  // シェル(head) を即送出 → 本文をストリーム → tail(runtime script)。TTFB を縮める。
  // env.renderShell を持つ環境のみ。preload はシェル送出時に島が未確定なので最小化する。
  if (mod.streaming === true && typeof env.renderShell === "function") {
    const { head, tail } = env.renderShell({ mod });
    const bodyStream = await renderToReadableStream(node);
    return {
      status: 200,
      headers: HTML,
      stream: streamedDocument(head, bodyStream, tail),
    };
  }

  const body = await renderToStringAsync(node);
  return { status: 200, headers: HTML, body: env.renderDocument({ mod, body }) };
}

// head → 本文ストリーム → tail を1つの Web ReadableStream に連結する。
function streamedDocument(head, bodyStream, tail) {
  const enc = new TextEncoder();
  const reader = bodyStream.getReader();
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode(head));
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(typeof value === "string" ? enc.encode(value) : value);
      }
      controller.enqueue(enc.encode(tail));
      controller.close();
    },
  });
}

async function render404(env, table, ctx, version) {
  ctx.resStatus = 404;
  if (table.notFound) {
    const mod = await env.importModule(table.notFound, version);
    if (typeof mod.default === "function") {
      await env.ensureIslands(version);
      const body = await renderToStringAsync(h(mod.default, { url: ctx.url }));
      return { status: 404, headers: HTML, body: env.renderDocument({ mod, body }) };
    }
  }
  return { status: 404, headers: HTML, body: "<h1>404 Not Found</h1>" };
}

async function render500(env, table, ctx, version, err) {
  if (table.errorRoute && !ctx._inErrorPage) {
    try {
      ctx._inErrorPage = true;
      const mod = await env.importModule(table.errorRoute, version);
      if (typeof mod.default === "function") {
        await env.ensureIslands(version);
        const message = env.dev ? String(err?.stack ?? err) : String(err?.message ?? err);
        const body = await renderToStringAsync(h(mod.default, { error: { message }, url: ctx.url }));
        return { status: 500, headers: HTML, body: env.renderDocument({ mod, body }) };
      }
    } catch {
      // ユーザー 500 自体が壊れたら下の組み込み表示にフォールバック
    }
  }
  return env.renderError(err);
}

// --- ルートテーブル補助 ---

// あるルートファイルに掛かるレイアウトを root→leaf 順で返す。
function layoutChain(table, file) {
  const chain = [];
  for (const entry of table.layouts ?? []) {
    if (underPrefix(routeUrlOf(table, file), entry.prefix)) chain.push(entry.file);
  }
  return chain;
}

function routeUrlOf(table, file) {
  const r = (table.routes ?? []).find((x) => x.file === file);
  if (!r) return "/";
  return "/" + r.segments.map((s) => (s.lit ?? `:${s.param}`)).join("/");
}

// pathname が prefix 配下か（prefix="" は全体）。
function underPrefix(pathname, prefix) {
  if (!prefix) return true;
  return pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : prefix + "/");
}

// loader/action/middleware の戻り値を結果に正規化する。
// Response → 取り込み、{status,headers,body} → そのまま、それ以外 → null（＝データ扱い）。
function toResult(out) {
  if (out == null) return null;
  if (typeof Response !== "undefined" && out instanceof Response) {
    return responseToResult(out);
  }
  if (out && out.__nowakiResult) return out; // ctx.redirect()/ctx.json() の戻り
  return null;
}

function responseToResult(res) {
  const headers = {};
  for (const [k, v] of res.headers) headers[k] = v;
  return { status: res.status, headers, stream: res.body, body: undefined, _response: res };
}
