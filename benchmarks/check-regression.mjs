// クライアント JS サイズの回帰ゲート。送信 JS は決定的（同じソース → 同じバイト）なので、
// CI で「うっかり依存を足してバンドルが膨らむ」回帰を検出できる。時間系（build/dev）は
// マシン依存でブレるのでゲートにしない（head-to-head.mjs の方で参考値として測る）。
//
// 使い方:
//   node benchmarks/check-regression.mjs           # baseline.json と比較（超過で exit 1）
//   node benchmarks/check-regression.mjs --update   # 現在値で baseline.json を更新
//
// 対象は benchmarks/apps/nowaki-counter（最小・安定）。閾値は gzip +12%。

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP = path.join(ROOT, "benchmarks/apps/nowaki-counter");
const BASELINE = path.join(ROOT, "benchmarks/baseline.json");
const TOLERANCE = 0.12; // gzip サイズの許容増加率
const UPDATE = process.argv.includes("--update");

const bin = existsSync(path.join(ROOT, "target/release/nowaki"))
  ? path.join(ROOT, "target/release/nowaki")
  : path.join(ROOT, "target/debug/nowaki");

function measure() {
  rmSync(path.join(APP, "dist"), { recursive: true, force: true });
  const r = spawnSync(bin, ["build", APP], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    console.error("build failed:\n", r.stderr ?? r.stdout);
    process.exit(2);
  }
  const clientDir = path.join(APP, "dist/client");
  let gz = 0;
  let jsFiles = 0;
  for (const f of readdirSync(clientDir)) {
    if (!f.endsWith(".js")) continue;
    gz += gzipSync(readFileSync(path.join(clientDir, f))).length;
    jsFiles += 1;
  }
  const manifest = JSON.parse(readFileSync(path.join(clientDir, "manifest.json"), "utf8"));
  const islands = Object.keys(manifest.islands ?? {}).length;
  rmSync(path.join(APP, "dist"), { recursive: true, force: true });
  return { gzipBytes: gz, jsFiles, islands };
}

const cur = measure();

if (UPDATE || !existsSync(BASELINE)) {
  writeFileSync(BASELINE, JSON.stringify(cur, null, 2) + "\n");
  console.log(`baseline ${UPDATE ? "updated" : "created"}:`, cur);
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, "utf8"));
const limit = Math.ceil(base.gzipBytes * (1 + TOLERANCE));
const kb = (b) => (b / 1024).toFixed(2);

let failed = false;
console.log(`client JS (gzip): ${kb(cur.gzipBytes)} KB  (baseline ${kb(base.gzipBytes)} KB, limit ${kb(limit)} KB)`);
if (cur.gzipBytes > limit) {
  console.error(`REGRESSION: shipped JS grew >${TOLERANCE * 100}% over baseline`);
  failed = true;
}
// 構造の変化（チャンク数・島数）も知らせる（致命ではないが baseline 更新の合図）。
if (cur.jsFiles !== base.jsFiles) {
  console.warn(`note: client chunk count ${base.jsFiles} → ${cur.jsFiles}`);
}
if (cur.islands !== base.islands) {
  console.warn(`note: island count ${base.islands} → ${cur.islands}`);
}

if (failed) {
  console.error("If this growth is intentional, run `node benchmarks/check-regression.mjs --update`.");
  process.exit(1);
}
console.log("OK: no client-JS size regression.");
process.exit(0);
