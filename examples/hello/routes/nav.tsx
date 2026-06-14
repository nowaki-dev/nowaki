// 型安全なナビゲーションのデモ。Link は型付きの <a>、route() は動的ルートの href を組む。
// ルート型は `nowaki typegen`（dev/build が自動生成）の .nowaki/types.d.ts による。
import { route, Link } from "@nowaki-dev/runtime/navigation";

export const title = "Typed nav — Nowaki";

export default function Nav() {
  return (
    <main style="font-family:system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:0 1.25rem">
      <h1>Typed navigation</h1>
      <ul>
        <li>
          <Link href="/about" data-testid="link-about">
            About（静的・型チェックあり）
          </Link>
        </li>
        <li>
          <a href={route("/blog/[slug]", { slug: "hello" })} data-testid="link-blog">
            最初の記事（route で組む）
          </a>
        </li>
        <li>
          <a href={route("/files/[...path]", { path: ["docs", "intro"] })} data-testid="link-files">
            ファイル（catch-all）
          </a>
        </li>
      </ul>
    </main>
  );
}
