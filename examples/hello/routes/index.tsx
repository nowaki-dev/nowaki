import Counter from "../islands/Counter.tsx";
import Logo from "../islands/Logo.tsx";
import Badge from "../islands/Badge.tsx";
import Cycle from "../islands/Cycle.tsx";

export const title = "Nowaki デモ";

export const loader = async () => {
  return { message: "Nowaki へようこそ 🍃", renderedAt: new Date().toISOString() };
};

type Data = Awaited<ReturnType<typeof loader>>;

export default function Home({ data }: { data: Data }) {
  return (
    <main style="font-family:sans-serif;max-width:640px;margin:4rem auto">
      <h1><Logo /> {data.message}</h1>
      <p>サーバーでレンダリング: {data.renderedAt}</p>
      <Counter start={5} /> <Badge /> <Cycle />
      <p>このページがブラウザに送るJSは、島 (Counter) の分だけです。</p>
      <p>
        <a href="/about">about (島なし・JSゼロのページ)</a> /{" "}
        <a href="/api/hello">APIルート</a>
      </p>
    </main>
  );
}
