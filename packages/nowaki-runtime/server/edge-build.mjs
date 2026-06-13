// Edge（Cloudflare Workers）アダプタのビルド時生成器。Node で実行される（fs あり）。
// dist/server を走査し、全サーバーモジュールを「静的 import」した worker エントリと
// wrangler 設定を dist/worker に出力する。Workers は実行時のファイル import を許さないため、
// ルート/レイアウト/middleware/島/manifest/ルートテーブルを全てバンドル前提で埋め込む。
//
// 使い方: node edge-build.mjs <serverDir> <clientDir> <workerDir> [appName]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { scanRoutes } from "./router.mjs";

const [serverDir, clientDir, workerDir, appNameArg] = process.argv.slice(2);
if (!serverDir || !clientDir || !workerDir) {
  console.error("usage: edge-build.mjs <serverDir> <clientDir> <workerDir> [appName]");
  process.exit(1);
}
const appName = appNameArg || "nowaki-app";

const manifest = JSON.parse(await readFile(path.join(clientDir, "manifest.json"), "utf8"));
const table = await scanRoutes(serverDir);

// 絶対ファイルパス → ルートテーブル用キー（serverDir からの相対, posix）
const keyOf = (abs) => path.relative(serverDir, abs).split(path.sep).join("/");
// worker(dist/worker/index.js) から dist/server/<key> への相対 import 指定子
const specOf = (key) => `../server/${key}`;

// 重複なくモジュールを集める（順序安定）。import 変数名を割り当てる。
const order = [];
const seen = new Map(); // key -> varName
const addModule = (abs) => {
  const key = keyOf(abs);
  if (!seen.has(key)) {
    const varName = `m${seen.size}`;
    seen.set(key, varName);
    order.push(key);
  }
  return seen.get(key);
};

// ルートテーブルの file をキーへ差し替えつつ、モジュールを登録する。
const routeTable = {
  routes: table.routes.map((r) => ({
    file: (addModule(r.file), keyOf(r.file)),
    segments: r.segments,
    isApi: r.isApi,
    specificity: r.specificity,
  })),
  layouts: table.layouts.map((l) => ({ prefix: l.prefix, file: (addModule(l.file), keyOf(l.file)) })),
  middleware: table.middleware.map((m) => ({
    prefix: m.prefix,
    file: (addModule(m.file), keyOf(m.file)),
  })),
  notFound: table.notFound ? (addModule(table.notFound), keyOf(table.notFound)) : null,
  errorRoute: table.errorRoute ? (addModule(table.errorRoute), keyOf(table.errorRoute)) : null,
};

// 島のサーバーモジュール（manifest.islands の名前 → dist/server/islands/<name>.js）
const islandImports = [];
const islandEntries = [];
let islIdx = 0;
for (const name of Object.keys(manifest.islands ?? {})) {
  const abs = path.join(serverDir, "islands", `${name}.js`);
  const v = `isl${islIdx++}`;
  islandImports.push(`import * as ${v} from ${JSON.stringify(specOf(`islands/${name}.js`))};`);
  islandEntries.push(`  ${JSON.stringify(name)}: ${v}.default,`);
}

// サーバー関数（`"use server"`）モジュールを静的 import に含める（実行時 import 不可なため）。
let serverFnTable = {};
try {
  serverFnTable = JSON.parse(await readFile(path.join(serverDir, "functions.json"), "utf8"));
} catch {
  // functions.json が無ければサーバー関数なし
}
for (const entry of Object.values(serverFnTable)) {
  addModule(path.join(serverDir, entry.module));
}

const moduleImports = order.map((key) => `import * as ${seen.get(key)} from ${JSON.stringify(specOf(key))};`);
const moduleEntries = order.map((key) => `  ${JSON.stringify(key)}: ${seen.get(key)},`);

const worker = `// 自動生成: Cloudflare Workers（Edge）アダプタの worker エントリ。
// 全サーバーモジュールを静的 import し、@nowaki-dev/runtime の web ハンドラに渡す。
import { createFetchHandler } from "@nowaki-dev/runtime/server/web.mjs";
${moduleImports.join("\n")}
${islandImports.join("\n")}

const manifest = ${JSON.stringify(manifest)};
const modules = {
${moduleEntries.join("\n")}
};
const islandComponents = {
${islandEntries.join("\n")}
};
const routeTable = ${JSON.stringify(routeTable)};
const serverFunctions = ${JSON.stringify(serverFnTable)};

const handler = createFetchHandler({ manifest, modules, islandComponents, routeTable, serverFunctions });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 静的アセットは Assets binding（dist/client）へ。/_nowaki/<f> → /<f> に書き換えて取得。
    if (url.pathname.startsWith("/_nowaki/") && env.ASSETS) {
      const assetUrl = new URL(url);
      assetUrl.pathname = url.pathname.slice("/_nowaki".length);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }
    return handler(request);
  },
};
`;

const wrangler = `{
  "name": ${JSON.stringify(appName)},
  "main": "index.js",
  "compatibility_date": "2024-11-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "../client",
    "binding": "ASSETS",
    "html_handling": "none",
    "not_found_handling": "none"
  }
}
`;

await mkdir(workerDir, { recursive: true });
await writeFile(path.join(workerDir, "index.js"), worker);
await writeFile(path.join(workerDir, "wrangler.jsonc"), wrangler);
console.log(
  `[nowaki] cloudflare adapter: ${order.length} server modules + ${islIdx} islands → ${path.join(workerDir, "index.js")}`,
);
