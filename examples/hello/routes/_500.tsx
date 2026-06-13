// loader/描画が投げたときに表示されるエラーページ（500）。
// dev では error.message にスタックが入る（直すと自動リロード）。prod はメッセージのみ。
export const title = "500 — Nowaki";

export default function ErrorPage({ error }: { error: { message: string } }) {
  return (
    <main>
      <h1>500</h1>
      <p>サーバーエラーが発生しました。</p>
      <pre style="white-space:pre-wrap;background:#f6f6f6;padding:1rem;border-radius:6px;overflow:auto">
        {error?.message}
      </pre>
      <a href="/">home に戻る</a>
    </main>
  );
}
