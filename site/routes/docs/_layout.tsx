// docs の共有レイアウト（/docs 配下を包む）。サイドバー + 読みやすい本文スタイル。
// 島は使わない → このページ群はクライアント JS ゼロ（Nowaki のドッグフーディング）。

const NAV = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/quickstart", label: "Quickstart" },
  { href: "/docs/routing", label: "Routing & data" },
  { href: "/docs/server-functions", label: "Server functions" },
  { href: "/docs/jetstream", label: "Jetstream islands" },
  { href: "/docs/plugins", label: "Plugins & virtual modules" },
  { href: "/docs/deploy", label: "Deploy" },
  { href: "/docs/migrate", label: "Migrate from Next.js" },
];

const CSS = `
:root{--ink:#11151c;--muted:#5b6472;--line:#e6e8ec;--bg:#fbfcfd;--card:#fff;--cyan:#0e7c86;--cyan-ink:#0a5b63;--code-bg:#0e1320;--code-ink:#e7ecf3}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--cyan-ink);text-decoration:none}
a:hover{text-decoration:underline}
.docs{display:grid;grid-template-columns:16rem minmax(0,1fr);gap:0;max-width:74rem;margin:0 auto;min-height:100vh}
.side{border-right:1px solid var(--line);padding:1.5rem 1.25rem;position:sticky;top:0;align-self:start;height:100vh;overflow:auto}
.brand{display:flex;align-items:baseline;gap:.5rem;font-weight:800;font-size:1.2rem;letter-spacing:-0.03em;margin-bottom:.25rem}
.brand small{font-weight:500;color:var(--muted);font-size:.78rem}
.side nav{margin-top:1.25rem;display:flex;flex-direction:column;gap:.15rem}
.side nav a{color:var(--ink);padding:.4rem .6rem;border-radius:7px;font-size:.93rem}
.side nav a:hover{background:#eef1f4;text-decoration:none}
.side nav a[aria-current=page]{background:var(--cyan);color:#fff;font-weight:600}
.side .ext{margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:.4rem;font-size:.88rem}
main{padding:2.5rem clamp(1.25rem,1rem + 2vw,3.5rem);max-width:50rem}
main h1{font-size:clamp(1.8rem,1.4rem + 1.8vw,2.4rem);letter-spacing:-0.03em;margin:.2rem 0 .4rem}
main h2{font-size:1.35rem;letter-spacing:-0.02em;margin:2.4rem 0 .6rem;padding-top:.6rem}
main h3{font-size:1.05rem;margin:1.6rem 0 .4rem}
main p,main li{color:#222b36}
main .lead{font-size:1.12rem;color:var(--muted);margin-top:0}
main code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em;background:#eef1f4;padding:.12em .4em;border-radius:5px}
main pre{background:var(--code-bg);color:var(--code-ink);padding:1rem 1.1rem;border-radius:11px;overflow:auto;font-size:.85rem;line-height:1.6;margin:1rem 0}
main pre code{background:none;padding:0;color:inherit;font-size:inherit}
main pre .c{color:#7d8aa3}.main-k{color:#8ab4f8}
main pre .k{color:#c4a3ff}main pre .s{color:#8fe6a4}main pre .f{color:#86d0ff}
table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:.92rem}
th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--muted)}
.note{border-left:3px solid var(--cyan);background:#f1f8f9;padding:.8rem 1rem;border-radius:0 9px 9px 0;margin:1.2rem 0;font-size:.95rem}
.pager{display:flex;justify-content:space-between;margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--line);font-size:.95rem}
.badge{display:inline-block;font-size:.72rem;font-weight:600;color:var(--cyan-ink);border:1px solid #bfe0e4;border-radius:999px;padding:.1rem .55rem;vertical-align:middle;margin-left:.5rem}
@media(max-width:820px){.docs{grid-template-columns:1fr}.side{position:static;height:auto;border-right:none;border-bottom:1px solid var(--line)}}
`;

export default function DocsLayout({ children, url }: { children: unknown; url?: URL }) {
  const path = url?.pathname ?? "";
  return (
    <div class="docs">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <aside class="side">
        <a href="/" class="brand">
          Nowaki <small>野分</small>
        </a>
        <div style="color:var(--muted);font-size:.82rem">Documentation</div>
        <nav>
          {NAV.map((n) => (
            <a href={n.href} aria-current={n.href === path ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div class="ext">
          <a href="https://github.com/nowaki-dev/nowaki">GitHub ↗</a>
          <a href="https://www.npmjs.com/package/nowaki">npm ↗</a>
          <a href="https://crates.io/crates/nowaki">crates.io ↗</a>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
