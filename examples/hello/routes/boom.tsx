// エラーバウンダリ（_500）のデモ。?boom=1 のときだけ loader が投げる。
// クエリ無し（prerender や通常ナビ）では普通に表示される。
type Ctx = { url: URL };

export const title = "Boom — Nowaki";

export const loader = (ctx: Ctx) => {
  if (ctx.url.searchParams.get("boom")) {
    throw new Error("意図的なエラー（_500.tsx のデモ）");
  }
  return {};
};

export default function Boom() {
  return (
    <main>
      <h1>Boom</h1>
      <p>
        <a href="/boom?boom=1">?boom=1 で 500 を発生させる</a>
      </p>
    </main>
  );
}
