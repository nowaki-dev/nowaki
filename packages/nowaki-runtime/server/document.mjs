// 本番ドキュメント組み立て（純粋な文字列処理。node 依存なし＝Node でも Edge でも使える）。
// 描画済み body を完成 HTML に包む / ストリーミング用に head と tail へ分ける。

// 非ストリーミング: body 全体を見て、使われた island の preload を <head> に入れる（瀑布回避）。
export function prodDocument(manifest, { mod, body }) {
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

  return `<!DOCTYPE html>
<html lang="${typeof mod.lang === "string" ? mod.lang : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(mod.title ?? "Nowaki App")}</title>
${preload}
${typeof mod.head === "string" ? mod.head : ""}
</head>
<body>
${body}
${runtime}
</body>
</html>`;
}

// ストリーミング: シェル送出時点で島が未確定なので per-island preload は省き、
// runtime チャンクだけ preload する（runtime が <nowaki-island> を見て各島を取得する）。
export function prodShell(manifest, mod) {
  const runtimeChunk = manifest.runtime;
  const runtimePreload = runtimeChunk
    ? `<link rel="modulepreload" href="/_nowaki/${runtimeChunk}" />\n`
    : "";
  const runtimeScript = runtimeChunk
    ? `<script type="module" src="/_nowaki/${runtimeChunk}"></script>`
    : "";
  const head = `<!DOCTYPE html>
<html lang="${typeof mod.lang === "string" ? mod.lang : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(mod.title ?? "Nowaki App")}</title>
${runtimePreload}${typeof mod.head === "string" ? mod.head : ""}
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
