// クライアントルーターの純粋ロジック（DOM 非依存・単体テスト可能）。
// router.js から使う。ここには window/document への参照を一切置かない。

// pathname に最もよく一致する境界（最長 prefix）を返す。prefix "" は全体に一致。
// loading/error 境界はネスト可能で、より深いディレクトリの境界が優先される。
export function matchBoundary(list, pathname) {
  let best = null;
  for (const b of list || []) {
    const p = b.prefix || "";
    const hit = p === "" || pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/");
    if (!hit) continue;
    if (best === null || p.length > (best.prefix || "").length) best = b;
  }
  return best;
}

// TTL + LRU の小さなページキャッシュ（Router Cache）。値は不透明（router.js では {doc,finalUrl}）。
// 同じ URL の再訪・戻る/進むがフェッチ無しで即座に復元できる。
export function createPageCache({ ttlMs = 30000, max = 32, now = () => Date.now() } = {}) {
  const map = new Map(); // key -> { value, at }
  const fresh = (e) => e && now() - e.at < ttlMs;
  return {
    get(key) {
      const e = map.get(key);
      if (!fresh(e)) {
        if (e) map.delete(key);
        return undefined;
      }
      map.delete(key); // LRU: 触れたものを末尾へ
      map.set(key, e);
      return e.value;
    },
    has(key) {
      const e = map.get(key);
      if (fresh(e)) return true;
      if (e) map.delete(key);
      return false;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, { value, at: now() });
      while (map.size > max) map.delete(map.keys().next().value); // 最古を追い出す
    },
    delete(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    size() {
      return map.size;
    },
  };
}
