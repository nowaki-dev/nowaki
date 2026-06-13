// ルート直下の _layout.tsx は全ページを包む（ネスト可）。共有ナビ + フッタ。
export default function RootLayout({
  children,
  url,
}: {
  children: unknown;
  url: URL;
}) {
  return (
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:2rem 1rem">
      <header style="display:flex;gap:1rem;border-bottom:1px solid #ddd;padding-bottom:.5rem;margin-bottom:1.5rem">
        <a href="/">home</a>
        <a href="/about">about</a>
        <a href="/todos">todos</a>
        <a href="/blog/hello">blog</a>
      </header>
      {children}
      <footer style="margin-top:2rem;border-top:1px solid #ddd;padding-top:.5rem;color:#888;font-size:.85rem">
        Nowaki demo · {url.pathname}
      </footer>
    </div>
  );
}
