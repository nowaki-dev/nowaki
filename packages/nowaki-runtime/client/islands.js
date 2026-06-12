// Islandsハイドレーションランタイム。
// SSRが埋め込んだ <nowaki-island src props> を見つけ、島モジュールだけを
// dynamic importしてハイドレートする。ページ本体のJSは存在しない。

import { h, hydrate } from "preact";

for (const el of document.querySelectorAll("nowaki-island")) {
  const src = el.getAttribute("src");
  const props = JSON.parse(el.getAttribute("props") || "{}");
  import(src).then(
    (mod) => hydrate(h(mod.default, props), el),
    (err) => console.error(`[nowaki] island読み込み失敗 ${src}:`, err),
  );
}
