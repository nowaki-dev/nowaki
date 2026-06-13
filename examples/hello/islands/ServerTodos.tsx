import { useState } from "preact/hooks";
import { addTodo, listTodos, whoami } from "../actions/todos.ts";

// クライアント島がサーバー関数を呼ぶ例。ボタン操作で addTodo/whoami を RPC 実行する。
// この島がブラウザへ送るのはハイドレーション用の島JS + プロキシだけ（実装はサーバー）。
export default function ServerTodos({ initial = [] }: { initial?: string[] }) {
  const [todos, setTodos] = useState<string[]>(initial);
  const [text, setText] = useState("");
  const [who, setWho] = useState("");

  return (
    <div data-testid="server-todos" style="border:1px solid #ccc;padding:1rem;border-radius:8px">
      <button
        data-testid="whoami"
        type="button"
        onClick={async () => setWho(await whoami())}
      >
        whoami
      </button>{" "}
      <span data-testid="who">{who}</span>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          setTodos(await addTodo(t));
          setText("");
        }}
      >
        <input
          data-testid="todo-input"
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          placeholder="new todo"
        />{" "}
        <button data-testid="add" type="submit">add</button>
      </form>
      <ul data-testid="todo-list">
        {todos.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <button
        data-testid="refresh"
        type="button"
        onClick={async () => setTodos(await listTodos())}
      >
        refresh
      </button>
    </div>
  );
}
