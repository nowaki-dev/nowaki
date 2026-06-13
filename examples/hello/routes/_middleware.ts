// _middleware.ts はそのディレクトリ配下のリクエスト前に実行される（ネスト可）。
// Response（ctx.redirect 等）を返すと短絡、返さなければ続行。
export default function middleware(ctx: {
  url: URL;
  setHeader: (k: string, v: string) => unknown;
  redirect: (to: string) => unknown;
}) {
  // ミドルウェアが走った証跡（ヘッダ操作のデモ）
  ctx.setHeader("x-nowaki-mw", "1");

  // 認証ガードのデモ: /secret は ?key=ok が無ければトップへリダイレクト。
  if (ctx.url.pathname === "/secret" && ctx.url.searchParams.get("key") !== "ok") {
    return ctx.redirect("/");
  }
}
