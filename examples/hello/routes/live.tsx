// サーバーリアクティブ島のデモ。クライアントにコンポーネント JS を送らずに対話する。
// クライアント島（Counter, 楽観UI）と共存することも示す。
import LiveCounter from "../islands/LiveCounter.tsx";
import Counter from "../islands/Counter.tsx";

export default function LivePage() {
  return (
    <main style="max-width:40rem;margin:3rem auto;padding:0 1.25rem;font-family:system-ui">
      <h1>Jetstream island</h1>
      <p>
        A Jetstream island ships <strong>no component JavaScript</strong>. Clicks go to the server
        over a WebSocket; the server re-renders and pushes an HTML patch that the client morphs in.
      </p>
      <LiveCounter />
      <p style="margin-top:2rem">
        Below is a regular client island (hydrated, optimistic) on the same page — the two kinds
        coexist:
      </p>
      <Counter start={10} />
    </main>
  );
}
