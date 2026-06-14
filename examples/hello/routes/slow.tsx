// わざと遅いローダー。クライアント遷移で loading 境界が出るのを確認するためのデモ。
// `?ms=600` で遅延を変えられる（既定 400ms）。
export const title = "Slow — Nowaki";

export const loader = async (ctx) => {
  const ms = Number(ctx.url.searchParams.get("ms") ?? 400);
  await new Promise((r) => setTimeout(r, Number.isFinite(ms) ? ms : 400));
  return { ms };
};

export default function Slow({ data }) {
  return (
    <main style="font-family:system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:0 1.25rem">
      <h1 data-testid="slow">Slow page</h1>
      <p>このページのローダーは {data.ms}ms かかります。クライアント遷移ではその間 loading 境界が出ます。</p>
      <a href="/">戻る</a>
    </main>
  );
}
