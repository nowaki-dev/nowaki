// Islands対応SSRレンダラー。
// preactのoptions.vnodeフックで「islands/配下のコンポーネント」を検知し、
// <nowaki-island> マーカーで包んでハイドレーション情報を埋め込む。
// Rust側のAST加工を不要にするためのランタイム方式 (Fresh classicと同系)。

import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { h, options } from "preact";
import { renderToStringAsync } from "preact-render-to-string";

const ISLAND_EXT = /\.(tsx|jsx|ts|js)$/;

// コンポーネント実体 → { name, src(ブラウザURL) }
let registry = new Map();
let registryVersion = null;

export async function loadIslandRegistry(appRoot, version) {
  if (registryVersion === version) return registry;
  const dir = path.join(appRoot, "islands");
  const next = new Map();
  let files = [];
  try {
    files = await readdir(dir);
  } catch {
    // islands/ なしでも動く
  }
  for (const f of files) {
    if (!ISLAND_EXT.test(f)) continue;
    const abs = path.join(dir, f);
    const mod = await import(`${pathToFileURL(abs).href}?v=${version}`);
    if (typeof mod.default !== "function") continue;
    next.set(mod.default, {
      name: f.replace(ISLAND_EXT, ""),
      src: `/islands/${f}`,
    });
  }
  registry = next;
  registryVersion = version;
  return registry;
}

const prevVnodeHook = options.vnode;
options.vnode = (vnode) => {
  if (
    typeof vnode.type === "function" &&
    registry.has(vnode.type) &&
    !vnode.props.__nowakiInner
  ) {
    const island = registry.get(vnode.type);
    const Original = vnode.type;
    vnode.type = (props) => {
      const { __nowakiInner, ...rest } = props;
      return h(
        "nowaki-island",
        {
          name: island.name,
          src: island.src,
          props: JSON.stringify(rest),
          style: "display:contents",
        },
        h(Original, { ...rest, __nowakiInner: true }),
      );
    };
  }
  if (prevVnodeHook) prevVnodeHook(vnode);
};

export async function renderPage(mod, ctx) {
  const Page = mod.default;
  if (typeof Page !== "function") {
    throw new Error(`ルートがコンポーネントをdefault exportしていません: ${ctx.url.pathname}`);
  }
  const data = mod.loader ? await mod.loader(ctx) : undefined;
  const body = await renderToStringAsync(
    h(Page, { data, params: ctx.params, url: ctx.url }),
  );
  return `<!DOCTYPE html>
<html lang="${typeof mod.lang === "string" ? mod.lang : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(mod.title ?? "Nowaki App")}</title>
${typeof mod.head === "string" ? mod.head : ""}
</head>
<body>
${body}
<script type="module" src="/node_modules/@nowaki-dev/runtime/client/islands.js"></script>
<script type="module" src="/node_modules/@nowaki-dev/runtime/client/hmr.js"></script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
