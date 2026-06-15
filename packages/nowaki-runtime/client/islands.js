// Islandsハイドレーションランタイム（= クライアントの eager エントリ）。
// SSRが埋め込んだ <nowaki-island src props client> を見つけ、島モジュールだけを
// dynamic importしてハイドレートする。ページ本体のJSは存在しない。
// SPA ルーター(router.js: Router Cache / loading / error / クリック横取り)は
// 初回描画では不要なので、ハイドレート後に idle で遅延ロードする（first-load を最小に保つ）。
//
// 遅延ハイドレーション（Astro 互換の client:* 指令）。島の `client` 属性で戦略を切替える:
//   load(既定) 即時 / idle requestIdleCallback / visible IntersectionObserver で可視時 /
//   media client-media のメディアクエリ一致時 / only SSR せずクライアントだけで render。

import { h, hydrate, render } from "preact";

export function hydrateIslands(root = document) {
  for (const el of root.querySelectorAll("nowaki-island")) {
    if (el.__nowakiHydrated) continue; // 二重ハイドレート防止（SPA 遷移時）
    el.__nowakiHydrated = true;
    schedule(el, el.getAttribute("client") || "load");
  }
}

// 戦略に応じて mount をスケジュールする。
function schedule(el, strategy) {
  const go = () => mount(el, strategy === "only");
  if (strategy === "idle") {
    "requestIdleCallback" in window ? requestIdleCallback(go, { timeout: 2000 }) : setTimeout(go, 1);
  } else if (strategy === "visible") {
    whenVisible(el, go);
  } else if (strategy === "media") {
    whenMedia(el.getAttribute("client-media") || "", go);
  } else {
    go(); // load / only / 未知 は即時
  }
}

// 島モジュールを読み込み、hydrate（SSR 済み）または render（client:only）する。
function mount(el, clientOnly) {
  const src = el.getAttribute("src");
  const props = JSON.parse(el.getAttribute("props") || "{}");
  import(src).then(
    (mod) => (clientOnly ? render : hydrate)(h(mod.default, props), el),
    (err) => console.error(`[nowaki] island読み込み失敗 ${src}:`, err),
  );
}

// IntersectionObserver で要素が可視になったら1度だけ実行（非対応なら即時）。
// <nowaki-island> は display:contents で箱を持たないので、SSR 済みの子要素を観測する。
function whenVisible(el, go) {
  if (!("IntersectionObserver" in window)) return go();
  const target = el.firstElementChild || el;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        io.disconnect();
        go();
        return;
      }
    }
  });
  io.observe(target);
}

// メディアクエリが一致したら実行（既に一致なら即時、後で一致したら一度だけ）。
function whenMedia(query, go) {
  if (!query || !window.matchMedia) return go();
  const mql = window.matchMedia(query);
  if (mql.matches) return go();
  const on = () => {
    if (mql.matches) {
      mql.removeEventListener("change", on);
      go();
    }
  };
  mql.addEventListener("change", on);
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
      // x-nowaki-rpc はサーバーの CSRF ゲート（functions.mjs）が要求する。
      headers: { "content-type": "application/json", "x-nowaki-rpc": "1" },
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
