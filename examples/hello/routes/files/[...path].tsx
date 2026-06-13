// 非同期・動的メタデータ: loader 結果や params から title/head/lang を生成できる。
export async function meta({ params }: { params: { path: string[] } }) {
  const p = Array.isArray(params.path) ? params.path.join("/") : "";
  return { title: `files/${p} — Nowaki` };
}

// catch-all ルート: /files/a/b/c → params.path === ["a", "b", "c"]
export default function Files({ params }: { params: { path: string[] } }) {
  const segs = Array.isArray(params.path) ? params.path : [];
  return (
    <main style="font-family:sans-serif;max-width:640px;margin:4rem auto">
      <h1>Catch-all route</h1>
      <p>
        <code>routes/files/[...path].tsx</code> matched.
      </p>
      <p data-testid="catchall">
        {segs.join(" / ")} ({segs.length})
      </p>
    </main>
  );
}
