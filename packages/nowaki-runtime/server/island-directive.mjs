// client:* 遅延ハイドレーション指令の解釈と <nowaki-island> ラップを集約する。
// dev(render.mjs) / prod(app.mjs) / edge(web.mjs) で共有する。
//
// 使い方（オーサリング）: <Counter client:visible />, <Counter client:idle />,
//   <Counter client:media="(min-width: 768px)" />, <Counter client:only />。
// 指令が無ければ client:load（ページ読み込み時にハイドレート）と同じ。
// Astro の `client:*` と同じ書き味。oxc は名前空間付き JSX 属性を
// `"client:visible"` のような prop キーとして渡すので、変換側の改修は不要。

import { h } from "preact";

import { stableStringify } from "./serialize.mjs";

const STRATEGIES = new Set(["load", "idle", "visible", "media", "only"]);

// props から client:<strategy> を取り出す（client:media は値=メディアクエリ）。
// 指令キーはシリアライズ対象から除外し、島へ prop としては渡さない。
function extractClient(props) {
  let strategy = null;
  let media = null;
  const rest = {};
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("client:")) {
      const s = k.slice("client:".length);
      if (STRATEGIES.has(s)) {
        strategy = s;
        if (s === "media" && typeof v === "string") media = v;
        continue;
      }
    }
    rest[k] = v;
  }
  return { strategy, media, rest };
}

// island を <nowaki-island> で包む。Original は SSR 用の元コンポーネント。
// client:only は SSR を行わず（クライアント専用 API を使う島向け）、クライアントで render する。
export function wrapIsland(island, props, Original) {
  const { __nowakiInner, ...raw } = props;
  void __nowakiInner;
  const { strategy, media, rest } = extractClient(raw);
  const attrs = {
    name: island.name,
    src: island.src,
    props: stableStringify(rest),
    style: "display:contents",
  };
  // client:load は既定（属性なし）。それ以外はクライアントへ戦略を伝える。
  if (strategy && strategy !== "load") attrs.client = strategy;
  if (media) attrs["client-media"] = media;
  const inner = strategy === "only" ? null : h(Original, { ...rest, __nowakiInner: true });
  return h("nowaki-island", attrs, inner);
}
