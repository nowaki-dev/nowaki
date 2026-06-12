import Counter from "../islands/Counter.tsx";

export const title = "Nowaki App";

export const loader = async () => {
  return { message: "Nowaki へようこそ 🌀" };
};

type Data = Awaited<ReturnType<typeof loader>>;

export default function Home({ data }: { data: Data }) {
  return (
    <main style="font-family:sans-serif;max-width:640px;margin:4rem auto">
      <h1>{data.message}</h1>
      <p>このカウンターだけがクライアントでハイドレートされる島です。</p>
      <Counter start={0} />
    </main>
  );
}
