import { listTodos } from "../actions/todos.ts";
import ServerTodos from "../islands/ServerTodos.tsx";

export const title = "Server functions — Nowaki";

// サーバー → サーバーは直接呼べる（HTTP を経由しない）。loader でそのまま await する。
export const loader = async () => {
  return await listTodos();
};

type Data = Awaited<ReturnType<typeof loader>>;

export default function Page({ data }: { data: Data }) {
  return (
    <main style="font-family:sans-serif;max-width:640px;margin:4rem auto">
      <h1>Server functions</h1>
      <p>
        <code>"use server"</code> モジュールの export は RPC 境界です。実装はサーバーに残り、
        クライアントには fetch する極小プロキシだけが届きます。
      </p>
      <ServerTodos initial={data} />
      <p style="margin-top:2rem">
        <a href="/">← home</a>
      </p>
    </main>
  );
}
