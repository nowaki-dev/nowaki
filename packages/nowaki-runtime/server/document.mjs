// 本番ドキュメント組み立て（純粋な文字列処理。node 依存なし＝Node でも Edge でも使える）。
// 描画済み body を完成 HTML に包む / ストリーミング用に head と tail へ分ける。

// 解決済みメタ（handler が loader 後に算出した {title,head,lang}）を優先し、無ければ
// route の静的 export（mod.title 等）にフォールバックする。
export function pageMeta(meta, mod) {
  const str = (v) => (typeof v === "string" ? v : undefined);
  return {
    title: str(meta?.title) ?? str(mod?.title) ?? "Nowaki App",
    head: str(meta?.head) ?? str(mod?.head) ?? "",
    lang: str(meta?.lang) ?? str(mod?.lang) ?? "en",
  };
}

// 非ストリーミング: body 全体を見て、使われた island の preload を <head> に入れる（瀑布回避）。
export function prodDocument(manifest, { mod, body, meta }) {
  const m = pageMeta(meta, mod);
  const islandNames = [...body.matchAll(/<nowaki-island name="([^"]+)"/g)].map((m) => m[1]);
  const hasIslands = islandNames.length > 0 && manifest.runtime;
  const preloadFiles = [];
  if (hasIslands) {
    const entryChunks = [
      manifest.runtime,
      ...islandNames.map((n) => manifest.islands?.[n]).filter(Boolean),
    ];
    const seen = new Set();
    for (const chunk of entryChunks) {
      if (!seen.has(chunk)) {
        seen.add(chunk);
        preloadFiles.push(chunk);
      }
      for (const dep of manifest.preload?.[chunk] ?? []) {
        if (!seen.has(dep)) {
          seen.add(dep);
          preloadFiles.push(dep);
        }
      }
    }
  }
  const preload = preloadFiles
    .map((f) => `<link rel="modulepreload" href="/_nowaki/${f}" />`)
    .join("\n");
  const runtime = hasIslands
    ? `<script type="module" src="/_nowaki/${manifest.runtime}"></script>`
    : "";
  // サーバーリアクティブ島があれば live.js（WS + morph）を読み込む。
  const live =
    body.includes("<nowaki-live") && manifest.liveRuntime
      ? `<script type="module" src="/_nowaki/${manifest.liveRuntime}"></script>`
      : "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(m.lang)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(m.title)}</title>
${preload}
${m.head}
</head>
<body>
${body}
${runtime}
${live}
</body>
</html>`;
}

// ストリーミング: シェル送出時点で島が未確定なので per-island preload は省き、
// runtime チャンクだけ preload する（runtime が <nowaki-island> を見て各島を取得する）。
export function prodShell(manifest, mod, meta) {
  const m = pageMeta(meta, mod);
  const runtimeChunk = manifest.runtime;
  const runtimePreload = runtimeChunk
    ? `<link rel="modulepreload" href="/_nowaki/${runtimeChunk}" />\n`
    : "";
  const runtimeScript = runtimeChunk
    ? `<script type="module" src="/_nowaki/${runtimeChunk}"></script>`
    : "";
  const head = `<!DOCTYPE html>
<html lang="${escapeHtml(m.lang)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(m.title)}</title>
${runtimePreload}${m.head}
</head>
<body>
`;
  const tail = `
${runtimeScript}
</body>
</html>`;
  return { head, tail };
}

export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
