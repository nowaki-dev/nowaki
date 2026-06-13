// 未一致リクエストはこのページで 404 を返す。
export const title = "404 — Nowaki";

export default function NotFound({ url }: { url: URL }) {
  return (
    <main>
      <h1>404</h1>
      <p>ページが見つかりません: <code>{url.pathname}</code></p>
      <a href="/">home に戻る</a>
    </main>
  );
}
