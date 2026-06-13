"use server";

// "use server" モジュール。ここの export はサーバーにだけ残る RPC エンドポイントになる。
// クライアントへは実装は出ず、fetch する極小プロキシだけが届く。
// （SERVER_SECRET や store はクライアントのバンドルに含まれない。）

import { getContext } from "@nowaki-dev/runtime/server/functions.mjs";

const SERVER_SECRET = "nowaki-server-only-secret-42";
const store: string[] = ["learn nowaki", "ship server functions"];

export async function listTodos(): Promise<string[]> {
  return store.slice();
}

export async function addTodo(text: string): Promise<string[]> {
  const t = String(text ?? "").trim();
  if (!t) throw new Error("empty todo");
  store.push(t);
  return store.slice();
}

// form の action に渡す版。`<form action={addTodoForm}>` の submit で FormData →
// { text } を受け取り、サーバー側で store を更新する。
export async function addTodoForm(form: { text?: string }): Promise<string[]> {
  const t = String(form?.text ?? "").trim();
  if (t) store.push(t);
  return store.slice();
}

// getContext() は RPC 実行中だけ有効。cookie/header からセッションを読める（認証など）。
export async function whoami(): Promise<string> {
  const ctx = getContext();
  const user = ctx?.cookies?.user ?? "anonymous";
  return `${user} (server secret is ${SERVER_SECRET.length} chars)`;
}
