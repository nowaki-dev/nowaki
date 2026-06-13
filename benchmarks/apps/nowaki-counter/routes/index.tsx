import Counter from "../islands/Counter.tsx";

export const title = "Counter — Nowaki";

export default function Home() {
  return (
    <main style="font-family:sans-serif;max-width:40rem;margin:4rem auto">
      <h1>Hello from Nowaki</h1>
      <p>Server-rendered page with one interactive island.</p>
      <Counter start={0} />
    </main>
  );
}
