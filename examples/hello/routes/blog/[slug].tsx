// 動的ルート [slug] + ネストレイアウト（blog/_layout → root/_layout）。
type Ctx = { params: { slug: string } };

export const title = "Blog — Nowaki";

export const loader = (ctx: Ctx) => ({ slug: ctx.params.slug });

export default function Post({ data }: { data: { slug: string } }) {
  return (
    <article>
      <h1>記事: {data.slug}</h1>
      <p>動的セグメント <code>[slug]</code> とネストレイアウトのデモ。</p>
    </article>
  );
}
