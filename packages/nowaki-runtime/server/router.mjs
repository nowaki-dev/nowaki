// ファイルベースルーティング: routes/ をスキャンしてURLパターンに変換する。
//   routes/index.tsx        → /
//   routes/about.tsx        → /about
//   routes/blog/[slug].tsx  → /blog/:slug
//   routes/api/hello.ts     → /api/hello (handler)

import { readdir } from "node:fs/promises";
import path from "node:path";

const ROUTE_EXT = /\.(tsx|ts|jsx|js)$/;

export async function scanRoutes(appRoot) {
  const routesDir = path.join(appRoot, "routes");
  const files = await walk(routesDir, "");
  return files
    .filter((rel) => ROUTE_EXT.test(rel))
    .map((rel) => {
      const isApi = rel === "api" || rel.startsWith("api/");
      let urlPath = "/" + rel.replace(ROUTE_EXT, "");
      if (urlPath.endsWith("/index")) {
        urlPath = urlPath.slice(0, -"/index".length) || "/";
      }
      const segments = urlPath
        .split("/")
        .filter(Boolean)
        .map((seg) => {
          const m = seg.match(/^\[(.+)\]$/);
          return m ? { param: m[1] } : { lit: seg };
        });
      return {
        file: path.join(routesDir, rel),
        segments,
        isApi,
        specificity: segments.filter((s) => s.lit).length,
      };
    })
    .sort((a, b) => b.specificity - a.specificity);
}

export function matchRoute(routes, pathname) {
  const parts = pathname.split("/").filter(Boolean);
  outer: for (const route of routes) {
    if (route.segments.length !== parts.length) continue;
    const params = {};
    for (let i = 0; i < parts.length; i++) {
      const seg = route.segments[i];
      const part = decodeURIComponent(parts[i]);
      if (seg.lit !== undefined) {
        if (seg.lit !== part) continue outer;
      } else {
        params[seg.param] = part;
      }
    }
    return { file: route.file, params, isApi: route.isApi };
  }
  return null;
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
