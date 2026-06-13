// action（form submission）のデモ。Cookie をストレージにした PRG パターン。
// GET: loader が Cookie から一覧を読む / POST: action が追記して /todos へリダイレクト。
type Ctx = {
  cookies: Record<string, string>;
  formData: () => Promise<URLSearchParams>;
  setCookie: (k: string, v: string, opts?: Record<string, unknown>) => unknown;
  redirect: (to: string) => unknown;
};

function readTodos(ctx: Ctx): string[] {
  try {
    return JSON.parse(ctx.cookies.todos ?? "[]");
  } catch {
    return [];
  }
}

export const title = "Todos — Nowaki";

export const loader = (ctx: Ctx) => ({ todos: readTodos(ctx) });

export async function action(ctx: Ctx) {
  const form = await ctx.formData();
  const text = String(form.get("text") ?? "").trim();
  if (text) {
    const todos = readTodos(ctx);
    todos.push(text);
    ctx.setCookie("todos", JSON.stringify(todos), { httpOnly: false });
  }
  return ctx.redirect("/todos");
}

export default function Todos({ data }: { data: { todos: string[] } }) {
  return (
    <main>
      <h1>Todos</h1>
      <form method="post" style="display:flex;gap:.5rem;margin:1rem 0">
        <input name="text" placeholder="やること" style="flex:1;padding:.4rem" />
        <button type="submit">追加</button>
      </form>
      <ul>
        {data.todos.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      {data.todos.length === 0 && <p style="color:#888">まだありません。</p>}
    </main>
  );
}
