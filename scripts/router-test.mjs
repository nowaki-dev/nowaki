// ルーター（scanRoutes / matchRoute）のスナップショット + 単体テスト。
// 実アプリ（examples/hello/routes）をスキャンし、代表パスのマッチ結果を固定する。
// さらに、静的ルートが同じ深さの動的ルートに優先することを合成テーブルで検証する。
//
// 使い方: node scripts/router-test.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanRoutes, matchRoute } from "../packages/nowaki-runtime/server/router.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(ROOT, "examples/hello");

let failed = 0;
const eq = (got, want, label) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

// マッチ結果を安定スナップショットに（絶対パス → basename）。
const snap = (table, pathname) => {
  const m = matchRoute(table, pathname);
  return m ? { file: path.basename(m.file), params: m.params, isApi: m.isApi } : null;
};

const table = await scanRoutes(app);

// --- 実アプリのルーティング・スナップショット ---
eq(snap(table, "/"), { file: "index.tsx", params: {}, isApi: false }, "/ -> index");
eq(snap(table, "/about"), { file: "about.tsx", params: {}, isApi: false }, "/about -> about");
eq(snap(table, "/blog/hello"), { file: "[slug].tsx", params: { slug: "hello" }, isApi: false }, "/blog/:slug param");
eq(snap(table, "/api/hello"), { file: "hello.ts", params: {}, isApi: true }, "/api/hello -> api (isApi)");
eq(snap(table, "/server-fn"), { file: "server-fn.tsx", params: {}, isApi: false }, "/server-fn route");
eq(snap(table, "/virtual"), { file: "virtual.tsx", params: {}, isApi: false }, "/virtual route");
eq(snap(table, "/blog"), null, "/blog (depth 1) does not match /blog/:slug (depth 2)");
eq(snap(table, "/nope/x/y"), null, "unknown deep path -> null");

// URL デコード（[slug] にエンコード文字）。
eq(snap(table, "/blog/a%20b"), { file: "[slug].tsx", params: { slug: "a b" }, isApi: false }, "param is url-decoded");

// 規約ファイルはルートにならない（_layout/_middleware/_404/_500 はテーブルの別枠）。
eq(
  table.routes.every((r) => !path.basename(r.file).startsWith("_")),
  true,
  "convention files are not routes",
);

// --- 合成テーブル: 静的ルートが同じ深さの動的ルートに優先する（specificity 降順）---
const syn = [
  { segments: [{ lit: "users" }, { param: "id" }], file: "dyn", isApi: false, specificity: 1 },
  { segments: [{ lit: "users" }, { lit: "me" }], file: "static", isApi: false, specificity: 2 },
].sort((a, b) => b.specificity - a.specificity);
eq(matchRoute(syn, "/users/me")?.file, "static", "static route wins over dynamic at same depth");
eq(matchRoute(syn, "/users/42")?.params, { id: "42" }, "dynamic route catches the rest");

console.log(failed ? `\nROUTER TEST FAILED (${failed})` : "\nROUTER TEST PASSED");
process.exit(failed ? 1 : 0);
