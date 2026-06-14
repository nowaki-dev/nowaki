// クライアントルーター（島間SPA遷移 / prefetch / スクロール復元 / Router Cache /
// loading・error 境界）。島ランタイムに同梱され、島のあるページで有効になる
// （JSゼロのページはフルナビ）。内部 <a> クリックを横取りし、遷移先 HTML を fetch して
// body を差し替え、新しい島だけを再ハイドレートする。
//
// - Router Cache: 訪問済みページを TTL+LRU で保持。戻る/進む・再訪が即時（フェッチ無し）。
// - loading.tsx: 遷移が 150ms を超えたら最寄りの loading 境界（無ければ既定のプログレスバー）を表示。
// - error.tsx: 遷移が失敗したら最寄りの error 境界（無ければ既定UI）を表示し、reset で再試行。

import { matchBoundary, createPageCache } from "./router-core.js";

// ハイドレートは eager ランタイム（islands.js）が window に公開する。
// ここから islands.js を import しないことで、ルーターを独立した遅延チャンクに保つ。
const hydrateIslands = (root) => window.__nowakiHydrateIslands?.(root);

const pageCache = createPageCache({ ttlMs: readCacheTtl(), max: 32 });
const scrollPos = new Map(); // history key -> scrollY
let boundariesPromise = null; // /__nowaki/boundaries の結果（一度だけ取得）
let navToken = 0; // 競合する遷移をガードするトークン

// <meta name="nowaki-router-cache" content="秒"> で Router Cache の TTL を上書き（既定 30s、0 で無効）。
function readCacheTtl() {
  if (typeof document === "undefined") return 30000;
  const m = document.querySelector('meta[name="nowaki-router-cache"]');
  const s = m && Number(m.getAttribute("content"));
  return Number.isFinite(s) && s >= 0 ? s * 1000 : 30000;
}

// 内部ナビゲーション対象の <a> か判定する。
function internalAnchor(target) {
  const a = target?.closest?.("a");
  if (!a) return null;
  const href = a.getAttribute("href");
  if (!href || href.startsWith("#")) return null;
  if (a.target && a.target !== "_self") return null;
  if (a.hasAttribute("download") || a.hasAttribute("data-no-router")) return null;
  let url;
  try {
    url = new URL(a.href, location.href);
  } catch {
    return null;
  }
  if (url.origin !== location.origin) return null;
  return url;
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { "x-nowaki-nav": "1" } });
  const html = await res.text();
  return {
    doc: new DOMParser().parseFromString(html, "text/html"),
    finalUrl: res.redirected ? res.url : url.toString(),
    status: res.status,
  };
}

// loading/error 境界の SSR HTML を一度だけ取得して使い回す。
function loadBoundaries() {
  if (!boundariesPromise) {
    boundariesPromise = fetch("/__nowaki/boundaries", { headers: { "x-nowaki-nav": "1" } })
      .then((r) => (r.ok ? r.json() : { loading: [], error: [] }))
      .catch(() => ({ loading: [], error: [] }));
  }
  return boundariesPromise;
}

function prefetch(url) {
  const key = url.toString();
  if (pageCache.has(key)) return;
  fetchPage(url)
    .then((r) => {
      if (r.status === 200) pageCache.set(key, r);
    })
    .catch(() => {});
}

async function navigate(url, { push = true } = {}) {
  const key = url.toString();
  const token = ++navToken;

  // Router Cache 即時ヒット（loading は出さない）。
  const cached = pageCache.get(key);
  if (cached) {
    applyDocument(cached, push, token);
    return cached.finalUrl;
  }

  const pending = fetchPage(url).then(
    (r) => r,
    () => null, // ネットワーク失敗
  );

  // 150ms 超えたら loading 表示（速い遷移ではちらつかせない）。
  const timer = setTimeout(async () => {
    if (token !== navToken) return;
    const { loading } = await loadBoundaries();
    if (token !== navToken) return;
    showLoading(matchBoundary(loading, url.pathname));
  }, 150);

  const result = await pending;
  clearTimeout(timer);
  if (token !== navToken) return; // 新しい遷移に追い越された

  if (!result) {
    await showError(url, "ページの読み込みに失敗しました");
    return;
  }
  if (result.status === 200) pageCache.set(key, result);
  applyDocument(result, push, token);
  return result.finalUrl;
}

// キャッシュ/フェッチ済みのドキュメントを実DOMへ反映する（body はクローンしてキャッシュを保つ）。
function applyDocument(entry, push, token) {
  if (token !== undefined && token !== navToken) return;
  scrollPos.set(historyKey(), window.scrollY);
  const { doc, finalUrl } = entry;
  document.title = doc.title;
  syncHead(doc);
  document.body.replaceWith(doc.body.cloneNode(true));
  if (push) {
    const k = String(Date.now()) + Math.round(performance.now());
    history.pushState({ nowaki: k }, "", finalUrl);
  }
  hydrateIslands(document);
  removeProgressBar();
}

// loading 境界（あればスケルトンで body を差し替え）。無ければ既定のプログレスバー。
function showLoading(boundary) {
  if (boundary) {
    const tmp = new DOMParser().parseFromString(`<body>${boundary.html}</body>`, "text/html");
    document.body.replaceWith(tmp.body);
  } else {
    showProgressBar();
  }
}

// error 境界（あれば表示し、data-nowaki-error にメッセージ、data-nowaki-reset に再試行を配線）。
async function showError(url, message) {
  const { error } = await loadBoundaries();
  const boundary = matchBoundary(error, url.pathname);
  if (boundary) {
    const tmp = new DOMParser().parseFromString(`<body>${boundary.html}</body>`, "text/html");
    for (const slot of tmp.body.querySelectorAll("[data-nowaki-error]")) slot.textContent = message;
    document.body.replaceWith(tmp.body);
  } else {
    showDefaultError(message);
  }
  for (const btn of document.querySelectorAll("[data-nowaki-reset]")) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(url, { push: false });
    });
  }
  removeProgressBar();
}

function showDefaultError(message) {
  const body = document.createElement("body");
  body.innerHTML = `<main style="font-family:system-ui,-apple-system,sans-serif;max-width:32rem;margin:6rem auto;padding:0 1.25rem">
    <h1 style="font-size:1.25rem;margin:0 0 .5rem">Something went wrong</h1>
    <p style="color:#56616f;margin:0 0 1.25rem">${escapeHtml(message)}</p>
    <button data-nowaki-reset type="button" style="font:inherit;cursor:pointer;border:1px solid #d7dbe0;background:#fff;border-radius:8px;padding:.5rem .9rem">Try again</button>
  </main>`;
  document.body.replaceWith(body);
}

// 既定のローディング表示: 画面上端の細いプログレスバー（現在のページは残す）。
let progressEl = null;
function showProgressBar() {
  if (progressEl) return;
  progressEl = document.createElement("div");
  progressEl.id = "nowaki-progress";
  progressEl.setAttribute("aria-hidden", "true");
  progressEl.style.cssText =
    "position:fixed;top:0;left:0;height:3px;width:0;z-index:2147483647;background:#0e7c86;transition:width .2s ease;box-shadow:0 0 8px rgba(14,124,134,.6)";
  document.body.appendChild(progressEl);
  requestAnimationFrame(() => {
    if (progressEl) progressEl.style.width = "80%";
  });
}
function removeProgressBar() {
  if (!progressEl) return;
  const el = progressEl;
  progressEl = null;
  el.style.width = "100%";
  setTimeout(() => el.remove(), 200);
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

// <head> の title 以外（meta/link 等、data-nowaki-css は除く）を新ページに合わせる。
function syncHead(doc) {
  const keep = (el) => el.hasAttribute("data-nowaki-css") || el.tagName === "TITLE";
  for (const el of [...document.head.children]) {
    if (!keep(el) && el.tagName !== "META" && el.tagName !== "LINK") continue;
    if (keep(el)) continue;
    el.remove();
  }
  for (const el of [...doc.head.children]) {
    if (el.tagName === "META" || el.tagName === "LINK") {
      document.head.appendChild(el.cloneNode(true));
    }
  }
}

function historyKey() {
  if (!history.state?.nowaki) {
    history.replaceState({ ...(history.state ?? {}), nowaki: "init" }, "");
  }
  return history.state.nowaki;
}

export function installRouter() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__nowakiRouter) return;
  window.__nowakiRouter = true;
  historyKey(); // 初期エントリにキーを付与
  loadBoundaries(); // 境界 HTML を先読み（非ブロッキング）

  // クリック横取り（修飾キー・中クリックは通常動作）
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const url = internalAnchor(e.target);
    if (!url) return;
    if (url.pathname === location.pathname && url.search === location.search) {
      return; // 同一ページ（ハッシュ等）はブラウザに任せる
    }
    e.preventDefault();
    navigate(url, { push: true }).then((final) => {
      window.scrollTo(0, 0);
      if (final) scrollPos.set(historyKey(), 0);
    });
  });

  // ホバー / タッチで prefetch
  const onHover = (e) => {
    const url = internalAnchor(e.target);
    if (url) prefetch(url);
  };
  document.addEventListener("mouseover", onHover, { passive: true });
  document.addEventListener("touchstart", onHover, { passive: true });

  // 戻る/進む（Router Cache があれば即時）
  window.addEventListener("popstate", () => {
    const url = new URL(location.href);
    navigate(url, { push: false }).then(() => {
      const y = scrollPos.get(historyKey()) ?? 0;
      window.scrollTo(0, y);
    });
  });

  // ブラウザのデフォルトのスクロール復元は無効化（自前で管理）
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
}

installRouter();
