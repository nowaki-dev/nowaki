// ISR（incremental static regeneration）デモ。
// `export const revalidate = <秒>` でオプトイン。`nowaki start` の Rust フロントは
// 組み立て済み HTML を path 単位でキャッシュし、鮮度切れは「古いものを即返し → 裏で再生成」。
// CDN/エッジ配備でも Cache-Control(s-maxage + stale-while-revalidate) で同じ挙動になる。
import type { PageProps } from "@nowaki-dev/runtime";

// 2 秒ごとに再検証。
export const revalidate = 2;

export const title = "ISR — Nowaki";

// モジュールスコープのカウンタ。再生成（loader 実行）のたびに増える。
let renders = 0;

export const loader = async () => {
  renders += 1;
  return { renders, at: new Date().toISOString() };
};

export default function Isr({ data }: PageProps<typeof loader>) {
  return (
    <main style="font-family:sans-serif;max-width:640px;margin:4rem auto">
      <h1>ISR demo</h1>
      <p>
        このページは <code>export const revalidate = 2</code> でキャッシュされます。リロードしても
        2 秒以内は同じ HTML（キャッシュ HIT）。2 秒経つと古い HTML を返しつつ裏で再生成します。
      </p>
      <p>
        render #<strong data-testid="isr-renders">{data.renders}</strong> · generated at{" "}
        <code data-testid="isr-at">{data.at}</code>
      </p>
      <p>
        応答の <code>x-nowaki-cache</code> ヘッダ（HIT / STALE / MISS）と{" "}
        <code>Cache-Control</code> を確認してみてください。
      </p>
      <a href="/">戻る</a>
    </main>
  );
}
