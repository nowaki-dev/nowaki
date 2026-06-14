// Vercel アダプタのビルド時生成器（Node 実行）。Vercel の Build Output API v3 を
// `.vercel/output/` に出力する。Build Output API の Function は自己完結が前提なので、
// サーバーモジュール（dist/server）と必要な node_modules（@nowaki-dev/runtime / preact /
// preact-render-to-string）を Function ディレクトリへ取り込む。静的アセットは static/ に置き、
// config.json のルーティングで /_nowaki/* を filesystem 配信、それ以外を Function に流す。
//
// 使い方: node vercel-build.mjs <serverDir> <clientDir> <outputDir> <appRoot>

import { writeFile, mkdir, cp, rm } from "node:fs/promises";
import path from "node:path";

const [serverDir, clientDir, outputDir, appRoot] = process.argv.slice(2);
if (!serverDir || !clientDir || !outputDir || !appRoot) {
  console.error("usage: vercel-build.mjs <serverDir> <clientDir> <outputDir> <appRoot>");
  process.exit(1);
}

const funcDir = path.join(outputDir, "functions", "index.func");
const staticDir = path.join(outputDir, "static");

// 既存出力を掃除してから作り直す。
await rm(outputDir, { recursive: true, force: true });
await mkdir(funcDir, { recursive: true });
await mkdir(staticDir, { recursive: true });

// 1) 静的アセット: dist/client/* → static/_nowaki/*（Vercel が配信）。
await cp(clientDir, path.join(staticDir, "_nowaki"), { recursive: true });

// 2) Function: サーバーモジュール + manifest + 必要な node_modules を取り込む。
await cp(serverDir, path.join(funcDir, "server"), { recursive: true });
await mkdir(path.join(funcDir, "client"), { recursive: true });
await cp(path.join(clientDir, "manifest.json"), path.join(funcDir, "client", "manifest.json"));

const nodeModules = path.join(funcDir, "node_modules");
for (const dep of ["@nowaki-dev/runtime", "preact", "preact-render-to-string"]) {
  const src = path.join(appRoot, "node_modules", dep);
  // 依存パッケージの「ネストした node_modules」は取り込まない。取り込むと preact が
  // 二重になり（runtime の devDep）、フックが別インスタンスになって SSR が壊れる。
  // Node は上位 node_modules を辿るので、トップレベルの単一 preact に解決される。
  await cp(src, path.join(nodeModules, dep), {
    recursive: true,
    dereference: true,
    filter: (s) => !path.relative(src, s).split(path.sep).includes("node_modules"),
  });
}

// Function ハンドラ: createApp の node:http 互換ハンドラ (req,res) をそのまま default export。
const handler = `// 自動生成: Vercel serverless function（Node）。
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "@nowaki-dev/runtime/server/app.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { handle } = await createApp({
  clientDir: path.join(here, "client"),
  serverDir: path.join(here, "server"),
});
export default handle;
`;
await writeFile(path.join(funcDir, "index.mjs"), handler);

// Function 設定（Node ランタイム、launcher=Nodejs で (req,res) ハンドラを受ける）。
await writeFile(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs20.x", handler: "index.mjs", launcherType: "Nodejs" }, null, 2) +
    "\n",
);

// ルーティング: /_nowaki/* は不変キャッシュで静的配信、残りは Function へ。
const config = {
  version: 3,
  routes: [
    {
      src: "/_nowaki/(.*)",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
      continue: true,
    },
    { handle: "filesystem" },
    { src: "/.*", dest: "/index" },
  ],
};
await writeFile(path.join(outputDir, "config.json"), JSON.stringify(config, null, 2) + "\n");

console.log(`[nowaki] vercel adapter: .vercel/output ready (static + index.func) → ${outputDir}`);
