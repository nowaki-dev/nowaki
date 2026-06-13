// blog/ 配下だけを包むネストレイアウト（root の _layout の内側に入る）。
export default function BlogLayout({ children }: { children: unknown }) {
  return (
    <section style="border-left:3px solid #4a9;padding-left:1rem">
      <p style="color:#4a9;font-size:.85rem;margin:0 0 .5rem">blog section</p>
      {children}
    </section>
  );
}
