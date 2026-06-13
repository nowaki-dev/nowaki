// Islandsハイドレーションランタイム。
// SSRが埋め込んだ <nowaki-island src props> を見つけ、島モジュールだけを
// dynamic importしてハイドレートする。ページ本体のJSは存在しない。
// クライアントルーター(router.js)が SPA 遷移後にも hydrateIslands を呼ぶ。

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

hydrateIslands();
