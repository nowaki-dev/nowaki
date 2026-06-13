// 島の props を決定的（安定）にシリアライズする。
// キー順を固定するので、同じ props は挿入順に関わらず常に同じ文字列になる。
// これは将来の差分検出（Jetstream の morph）・遅延ハイドレーション・キャッシュの基盤。

export function stableStringify(value) {
  return stringify(value);
}

function stringify(v) {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) {
    return "[" + v.map(stringify).join(",") + "]";
  }
  // toJSON を尊重（Date 等）
  if (typeof v.toJSON === "function") return stringify(v.toJSON());
  const keys = Object.keys(v).sort();
  const parts = [];
  for (const k of keys) {
    const val = v[k];
    if (val === undefined) continue; // JSON と同じく undefined は省く
    parts.push(JSON.stringify(k) + ":" + stringify(val));
  }
  return "{" + parts.join(",") + "}";
}
