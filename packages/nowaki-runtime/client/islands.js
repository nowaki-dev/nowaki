// Islandsハイドレーションランタイム（= クライアントの eager エントリ）。
// SSRが埋め込んだ <nowaki-island src props> を見つけ、島モジュールだけを
// dynamic importしてハイドレートする。ページ本体のJSは存在しない。
// SPA ルーター(router.js: Router Cache / loading / error / クリック横取り)は
// 初回描画では不要なので、ハイドレート後に idle で遅延ロードする（first-load を最小に保つ）。

import { h, hydrate } from "preact";

export function hydrateIslands(root = document) {
  for (const el of root.querySelectorAll("nowaki-island")) {
    if (el.__nowakiHydrated) continue; // 二重ハイドレート防止（SPA 遷移時）
    el.__nowakiHydrated = true;
    const src = el.getAttribute("src");
    const props = JSON.parse(el.getAttribute("props") || "{}");
    import(src).then(
      (mod) => hydrate(h(mod.default, props), el),
      (err) => console.error(`[nowaki] island読み込み失敗 ${src}:`, err),
    );
  }
}

// `<form action={serverFn}>` の傍受。preact は server fn の toString（"__nowaki_action:<id>"）を
// action 属性に入れるので、submit をここで拾って FormData を server fn へ送る（ページ遷移しない）。
// 結果は form に `nowaki:action` イベント（detail: { id, ok, result, error }）で通知する。
const ACTION_PREFIX = "__nowaki_action:";
document.addEventListener("submit", async (ev) => {
  const form = ev.target;
  if (!(form instanceof HTMLFormElement)) return;
  const action = form.getAttribute("action") || "";
  if (!action.startsWith(ACTION_PREFIX)) return;
  ev.preventDefault();
  const id = action.slice(ACTION_PREFIX.length);
  const fields = Object.fromEntries(new FormData(form));
  let ok = false;
  let result;
  let error;
  try {
    const res = await fetch("/__nowaki/fn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, args: [fields] }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    ok = res.ok;
    result = ok ? (data ? data.result : null) : undefined;
    error = data && data.error;
  } catch (e) {
    error = String(e);
  }
  form.dispatchEvent(new CustomEvent("nowaki:action", { bubbles: true, detail: { id, ok, result, error } }));
});

// SPA ルーターは window 経由でハイドレートを呼ぶ（islands.js を再バンドルさせないための分離）。
if (typeof window !== "undefined") window.__nowakiHydrateIslands = hydrateIslands;

hydrateIslands();

// SPA ルーターを遅延ロード（first-load JS を小さく保つ）。ランタイム <script> の
// data-router 属性（サーバーが注入）にチャンク URL があれば、idle で import する。
// ロード前のクリックは通常のフルナビになる（グレースフルデグラデーション）。
if (typeof document !== "undefined") {
  const runtimeEl = document.getElementById("nowaki-runtime");
  const routerSrc = runtimeEl && runtimeEl.getAttribute("data-router");
  if (routerSrc) {
    const load = () => import(routerSrc).catch(() => {});
    if ("requestIdleCallback" in window) requestIdleCallback(load, { timeout: 800 });
    else setTimeout(load, 1);
  }
}
