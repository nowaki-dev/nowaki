// ファイルベースルーティング: routes/ をスキャンしてルートテーブルへ変換する。
//   routes/index.tsx        → /
//   routes/about.tsx        → /about
//   routes/blog/[slug].tsx  → /blog/:slug
//   routes/api/hello.ts     → /api/hello (handler)
// 規約ファイル（通常ルートにはしない）:
//   _layout.tsx     そのディレクトリ配下のページを包む（ネスト可）
//   _middleware.ts  そのディレクトリ配下のリクエスト前処理（ネスト可）
//   _404.tsx        未一致時のページ
//   _500.tsx /_error.tsx  描画失敗時のページ
//   loading.tsx     クライアント遷移中に出すローディングUI（ネスト可）
//   error.tsx       クライアント遷移失敗時のフォールバックUI（ネスト可）

import { readdir } from "node:fs/promises";
import path from "node:path";

const ROUTE_EXT = /\.(tsx|ts|jsx|js)$/;

export async function scanRoutes(appRoot) {
  const routesDir = path.join(appRoot, "routes");
  const files = (await walk(routesDir, "")).filter((rel) => ROUTE_EXT.test(rel));

  const routes = [];
  const layouts = [];
  const middleware = [];
  const loadingBoundaries = [];
  const errorBoundaries = [];
  let notFound = null;
  let errorRoute = null;

  for (const rel of files) {
    const abs = path.join(routesDir, rel);
    const base = path.basename(rel).replace(ROUTE_EXT, "");
    const dirPrefix = dirToPrefix(path.dirname(rel));

    if (base === "_layout") {
      layouts.push({ prefix: dirPrefix, file: abs });
      continue;
    }
    if (base === "_middleware") {
      middleware.push({ prefix: dirPrefix, file: abs });
      continue;
    }
    if (base === "loading") {
      loadingBoundaries.push({ prefix: dirPrefix, file: abs });
      continue;
    }
    if (base === "error") {
      errorBoundaries.push({ prefix: dirPrefix, file: abs });
      continue;
    }
    if (base === "_404") {
      notFound = abs;
      continue;
    }
    if (base === "_500" || base === "_error") {
      errorRoute = abs;
      continue;
    }
    if (base.startsWith("_")) continue; // 予約

    const isApi = rel === "api" || rel.startsWith("api/");
    let urlPath = "/" + rel.replace(ROUTE_EXT, "");
    if (urlPath.endsWith("/index")) {
      urlPath = urlPath.slice(0, -"/index".length) || "/";
    }
    const segments = urlPath
      .split("/")
      .filter(Boolean)
      .map((seg) => {
        const rest = seg.match(/^\[\.\.\.(.+)\]$/); // [...slug] = catch-all
        if (rest) return { param: rest[1], rest: true };
        const m = seg.match(/^\[(.+)\]$/);
        return m ? { param: m[1] } : { lit: seg };
      });
    routes.push({
      file: abs,
      segments,
      isApi,
      specificity: segments.filter((s) => s.lit).length,
      rest: segments.some((s) => s.rest),
    });
  }

  // 静的 > 動的 > catch-all。specificity（リテラル数）降順、同点なら catch-all を後に。
  routes.sort((a, b) => b.specificity - a.specificity || (a.rest ? 1 : 0) - (b.rest ? 1 : 0));
  // root→leaf 順（短い prefix を先に）
  layouts.sort((a, b) => a.prefix.length - b.prefix.length);
  middleware.sort((a, b) => a.prefix.length - b.prefix.length);

  return { routes, layouts, middleware, loadingBoundaries, errorBoundaries, notFound, errorRoute };
}

export function matchRoute(routesOrTable, pathname) {
  const routes = Array.isArray(routesOrTable) ? routesOrTable : routesOrTable.routes;
  const parts = pathname.split("/").filter(Boolean);
  outer: for (const route of routes) {
    const segs = route.segments;
    const rest = segs.length > 0 && segs[segs.length - 1].rest;
    if (rest) {
      // 末尾の catch-all は残り（≥1）を束ねる。固定部 = segs.length - 1。
      if (parts.length < segs.length) continue;
    } else if (segs.length !== parts.length) {
      continue;
    }
    const params = {};
    const fixed = rest ? segs.length - 1 : segs.length;
    for (let i = 0; i < fixed; i++) {
      const seg = segs[i];
      const part = decodeURIComponent(parts[i]);
      if (seg.lit !== undefined) {
        if (seg.lit !== part) continue outer;
      } else {
        params[seg.param] = part;
      }
    }
    if (rest) {
      // catch-all param は残りセグメントの配列。
      params[segs[segs.length - 1].param] = parts.slice(fixed).map((p) => decodeURIComponent(p));
    }
    return { file: route.file, params, isApi: route.isApi };
  }
  return null;
}

// "." → ""(ルート), "blog" → "/blog", "blog/2024" → "/blog/2024"
function dirToPrefix(dir) {
  if (!dir || dir === ".") return "";
  return "/" + dir.split(path.sep).join("/");
}

async function walk(dir, prefix) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await walk(path.join(dir, entry.name), rel)));
    } else {
      out.push(rel);
    }
  }
  return out;
}
