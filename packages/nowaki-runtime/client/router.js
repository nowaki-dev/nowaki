// クライアントルーター（島間SPA遷移 / prefetch / スクロール復元）。
// 島ランタイムに同梱され、島のあるページで有効になる（JSゼロのページはフルナビ）。
// 内部 <a> クリックを横取りし、遷移先 HTML を fetch して body を差し替え、
// 新しい島だけを再ハイドレートする。DOM 差し替え技術は将来 Jetstream と共有する。

import { hydrateIslands } from "./islands.js";

const pageCache = new Map(); // url -> Promise<Document>
const scrollPos = new Map(); // history key -> scrollY

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
  };
}

function prefetch(url) {
  const key = url.toString();
  if (pageCache.has(key)) return;
  pageCache.set(
    key,
    fetchPage(url).catch((e) => {
      pageCache.delete(key);
      throw e;
    }),
  );
}

async function navigate(url, { push = true } = {}) {
  const key = url.toString();
  let entry = pageCache.get(key);
  if (!entry) {
    entry = fetchPage(url);
    pageCache.set(key, entry);
  }
  let result;
  try {
    result = await entry;
  } catch {
    location.href = key; // フォールバック: 通常遷移
    return;
  }
  pageCache.delete(key);

  // 現在のスクロール位置を保存
  scrollPos.set(historyKey(), window.scrollY);

  const { doc, finalUrl } = result;
  document.title = doc.title;
  syncHead(doc);
  document.body.replaceWith(doc.body);

  if (push) {
    const k = String(Date.now()) + Math.round(performance.now());
    history.pushState({ nowaki: k }, "", finalUrl);
  }

  hydrateIslands(document);
  return finalUrl;
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
  if (window.__nowakiRouter) return;
  window.__nowakiRouter = true;
  historyKey(); // 初期エントリにキーを付与

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

  // 戻る/進む
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
