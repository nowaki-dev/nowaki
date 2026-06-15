// ISR + ヘッダ依存ルート。security e2e がクロスユーザーのキャッシュ隔離を検証するために使う。
// accept-language を読むので、Vary 学習でその値がキャッシュキーに織り込まれ、
// 別言語のリクエストが他言語のキャッシュ済み内容を受け取らない（#6/#7 の回帰ガード）。
export const revalidate = 30;

export const loader = (ctx: { get: (name: string) => string | undefined }) => ({
  lang: ctx.get("accept-language") ?? "none",
});

type Data = { lang: string };

export default function Vary({ data }: { data: Data }) {
  return (
    <article>
      <h1>vary</h1>
      <p>LANG={data.lang}</p>
    </article>
  );
}
