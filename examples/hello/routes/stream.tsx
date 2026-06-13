// ストリーミング SSR のデモ。`streaming = true` でシェルを即送出し、本文をストリームする。
import Counter from "../islands/Counter.tsx";

export const streaming = true;

export const loader = async () => {
  // 実アプリの「遅いデータ取得」を模す。シェルは待たずに先に届く。
  await new Promise((r) => setTimeout(r, 40));
  return { mode: "streamed" };
};

export default function Stream({ data }: { data: { mode: string } }) {
  return (
    <main style="max-width:40rem;margin:3rem auto;padding:0 1.25rem;font-family:system-ui">
      <h1>Streaming SSR</h1>
      <p>
        This page used <code>export const streaming = true</code>. The shell is flushed before the
        loader resolves; loader said: <strong>{data.mode}</strong>.
      </p>
      <Counter start={5} />
    </main>
  );
}
