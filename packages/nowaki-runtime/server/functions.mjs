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
