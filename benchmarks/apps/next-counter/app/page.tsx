import Counter from "./counter";

export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: "40rem", margin: "4rem auto" }}>
      <h1>Hello from Next</h1>
      <p>Server-rendered page with one interactive island.</p>
      <Counter start={0} />
    </main>
  );
}
