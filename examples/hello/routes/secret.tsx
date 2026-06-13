// _middleware のガード対象。?key=ok のときだけ表示される。
export const title = "Secret — Nowaki";

export default function Secret() {
  return (
    <main>
      <h1>Secret</h1>
      <p>ミドルウェアのガードを通過しました。</p>
    </main>
  );
}
