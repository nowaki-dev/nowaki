// Islands対応SSRレンダラー。
// preactのoptions.vnodeフックで「islands/配下のコンポーネント」を検知し、
// <nowaki-island> マーカーで包んでハイドレーション情報を埋め込む。
// Rust側のAST加工を不要にするためのランタイム方式 (Fresh classicと同系)。

import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { h, options } from "preact";

import { stableStringify } from "./serialize.mjs";

const ISLAND_EXT = /\.(tsx|jsx|ts|js|tsrx)$/;

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
          props: stableStringify(rest),
          style: "display:contents",
        },
        h(Original, { ...rest, __nowakiInner: true }),
      );
    };
  }
  if (prevVnodeHook) prevVnodeHook(vnode);
};

// 完成 HTML の head（…<body>）と tail（</body>…）を返す。dev 用。
// 非ストリーミングは renderDocument が body を挟むだけ、ストリーミングは handler が本文を流し込む。
export function renderShell({ mod }) {
  const head = `<!DOCTYPE html>
<html lang="${typeof mod.lang === "string" ? mod.lang : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(mod.title ?? "Nowaki App")}</title>
${typeof mod.head === "string" ? mod.head : ""}
</head>
<body>
`;
  const tail = `
${devScripts()}
</body>
</html>`;
  return { head, tail };
}

// 描画済み body を完成 HTML に包む（dev 用: islands.js + クライアントルーター + hmr.js）。
// 実際のページ描画・loader 実行は handler.mjs が担当する。
export function renderDocument({ mod, body }) {
  const { head, tail } = renderShell({ mod });
  return `${head}${body}${tail}`;
}

function devScripts() {
  // router.js が islands.js を取り込む（ハイドレーション + SPA 遷移）。dev は常に読み込む。
  const router =
    '<script type="module" src="/node_modules/@nowaki-dev/runtime/client/router.js"></script>\n';
  const hmr =
    '<script type="module" src="/node_modules/@nowaki-dev/runtime/client/hmr.js"></script>';
  return `${router}${hmr}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// dev: SSR エラーを表示する 500 ページ。hmr.js を含むので修正後に自動リロードする。
export function errorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Nowaki — build error</title></head>
<body style="margin:0;background:#0a0c12;color:#e6e6e6;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace">
<div style="max-width:920px;margin:0 auto;padding:2.5rem 2rem">
<div style="color:#ff6b6b;font-weight:700;font-size:15px;margin-bottom:1rem">Nowaki — build error</div>
<pre style="white-space:pre-wrap;margin:0">${escapeHtml(message)}</pre>
<div style="margin-top:1.5rem;color:#8a8f98">Fix the error and save; the page reloads automatically.</div>
</div>
<script type="module" src="/node_modules/@nowaki-dev/runtime/client/hmr.js"></script>
</body>
</html>`;
}
