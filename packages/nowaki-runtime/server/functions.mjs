// サーバー関数（`"use server"`）の dispatch とリクエストコンテキスト。
// クライアントのプロキシは `POST /__nowaki/fn` に `{ id, args }` を送る。ここで id を
// allowlist（dev は Rust の discover、prod は dist/server/functions.json、edge は静的）で
// 引き、対象 export を `getContext()` で ctx を見られる AsyncLocalStorage の中で実行する。
//
// セキュリティ: 呼べるのは allowlist にある id（= `"use server"` モジュールの export）だけ。
// クライアントが module/export を指定して任意の関数を呼ぶことはできない。

import { AsyncLocalStorage } from "node:async_hooks";

export const SERVER_FN_PATH = "/__nowaki/fn";

const JSON_CT = { "content-type": "application/json; charset=utf-8" };

// 実行中のサーバー関数から見えるリクエストコンテキスト（cookie/headers/レスポンス操作）。
const als = new AsyncLocalStorage();

/// サーバー関数の中から呼ぶと、その呼び出しの LoaderContext を返す（無ければ null）。
/// 例: 認証・cookie 読み取り。`import { getContext } from "@nowaki-dev/runtime/server/functions.mjs"`
export function getContext() {
  return als.getStore() ?? null;
}

/// `/__nowaki/fn` を処理する。`sf` は `{ lookup(id, version), importModule(module, version) }`。
/// 各エントリポイント（dev/prod/edge）が sf の中身を環境ごとに用意する。
export async function dispatchServerFn(ctx, info, sf) {
  if (ctx.method !== "POST") {
    return errBody(405, "Method Not Allowed");
  }
  // CSRF / クロスオリジン対策。サーバー関数は cookie 認証・状態変更の口なので、
  // 他オリジンのページから victim の cookie 付きで呼ばれないよう三重に塞ぐ:
  //  (1) Content-Type は application/json 必須（text/plain 等の "単純リクエスト" を排除）
  //  (2) カスタムヘッダ x-nowaki-rpc 必須（クロスサイトの単純リクエストでは付与できず、
  //      プリフライトが要るが本サーバーは CORS 許可を返さないのでブラウザが弾く）
  //  (3) Origin があれば Host と同一オリジンのみ許可
  // メディアタイプ本体（パラメータ前）で厳密判定する。substring 一致だと
  // `multipart/form-data; boundary=application/json` のような CORS 単純リクエストを
  // 取りこぼすため、`;` より前を正規化して application/json のみ許可する。
  const ct = String(ctx.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (ct !== "application/json") {
    return errBody(415, "Unsupported Media Type");
  }
  if (ctx.get("x-nowaki-rpc") !== "1") {
    return errBody(403, "Forbidden");
  }
  // Rust フロント(dev/prod)はサイドカーへ転送する際に Host を剥がすので、元 Host は
  // x-forwarded-host で受け取る。どちらも無ければ比較不能なので Origin 検証は省略し、
  // 上の rpc ヘッダ + JSON 必須（プリフライト強制）でクロスオリジンを防ぐ。
  const origin = ctx.get("origin");
  // プロキシ経由では上流クライアントが Host を上書きするので、転送された
  // x-forwarded-host（元のブラウザ Host）を優先する。直結時は素の Host。
  const host = ctx.get("x-forwarded-host") ?? ctx.get("host");
  if (origin && host && !sameOrigin(origin, host)) {
    return errBody(403, "cross-origin request forbidden");
  }
  let payload = null;
  try {
    payload = await ctx.bodyJson();
  } catch {
    payload = null;
  }
  const id = payload && typeof payload.id === "string" ? payload.id : null;
  const args = payload && Array.isArray(payload.args) ? payload.args : [];
  if (!id) {
    return errBody(400, "Bad Request: missing id");
  }
  const entry = await sf.lookup(id, info.version);
  if (!entry) {
    return errBody(404, "unknown server function");
  }
  try {
    const mod = await sf.importModule(entry.module, info.version);
    const fn = mod[entry.export];
    if (typeof fn !== "function") {
      return errBody(500, `server function is not a function: ${entry.export}`);
    }
    const result = await als.run(ctx, () => fn(...args));
    return {
      status: 200,
      headers: JSON_CT,
      body: JSON.stringify({ result: result === undefined ? null : result }),
    };
  } catch (err) {
    // 実装の詳細（スタック）はクライアントへ返さない。message のみ。
    return errBody(500, String(err?.message ?? err));
  }
}

function errBody(status, message) {
  return { status, headers: JSON_CT, body: JSON.stringify({ error: message }) };
}

// Origin ヘッダ（"scheme://host[:port]"）の host:port が Host ヘッダと一致するか。
function sameOrigin(origin, host) {
  if (!host) return false;
  const i = origin.indexOf("://");
  const originHost = i >= 0 ? origin.slice(i + 3).replace(/\/$/, "") : origin;
  return originHost === host;
}
