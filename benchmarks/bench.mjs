// Nowaki の素朴で再現可能なベンチ。誇張せず「自分のアプリで測った数字」を出す。
//   - dev server ready: `nowaki dev` 起動から ready までの時間（cold / warm）
//   - build: `nowaki build` の所要時間
//   - shipped JS: dist/client の全 JS チャンクの gzip 合計
//   - TTFB: `nowaki start`（Rust front）で `/` の time-to-first-byte
//
// 使い方: node benchmarks/bench.mjs [appDir] [nowakiBin]
//   appDir   既定 examples/hello
//   nowakiBin 既定 ./target/release/nowaki（無ければ ./target/debug/nowaki）
//
// 注意: examples/hello は .tsrx・プラグイン・ライブ島まで含むキッチンシンク。
// 数字には plugin host 起動なども含む（典型的な実アプリの上限寄り）。

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const appDir = path.resolve(process.argv[2] ?? path.join(ROOT, "examples/hello"));
const bin =
  process.argv[3] ??
  (existsSync(path.join(ROOT, "target/release/nowaki"))
    ? path.join(ROOT, "target/release/nowaki")
    : path.join(ROOT, "target/debug/nowaki"));

const now = () => Number(process.hrtime.bigint() / 1000000n); // ms
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 子プロセスを起動し、stdout に `marker` が出るまでの時間を測る。kill して返す。
function timeUntil(args, marker, env = {}) {
  return new Promise((resolve, reject) => {
    const t0 = now();
    const child = spawn(bin, args, { cwd: ROOT, env: { ...process.env, ...env } });
    let done = false;
    const onData = (buf) => {
      if (!done && buf.toString().includes(marker)) {
        done = true;
        const dt = now() - t0;
        child.kill("SIGKILL");
        resolve({ ms: dt, child });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", () => {
      if (!done) reject(new Error(`marker "${marker}" not seen`));
    });
    setTimeout(() => {
      if (!done) {
        child.kill("SIGKILL");
        reject(new Error("timeout"));
      }
    }, 30000);
  });
}

function clean() {
  for (const d of ["dist", "node_modules/.cache/nowaki"]) {
    rmSync(path.join(appDir, d), { recursive: true, force: true });
  }
}

async function devReady() {
  // cold（キャッシュ無し）と warm（2回目）を測る
  clean();
  const cold = await timeUntil(["dev", appDir, "--port", "0"], "ready in");
  await sleep(300);
  const warm = await timeUntil(["dev", appDir, "--port", "0"], "ready in");
  return { cold: cold.ms, warm: warm.ms };
}

function buildTime() {
  clean();
  const t0 = now();
  const r = spawnSync(bin, ["build", appDir], { cwd: ROOT });
  if (r.status !== 0) throw new Error("build failed: " + (r.stderr?.toString() ?? ""));
  return now() - t0;
}

function shippedJs() {
  const dir = path.join(appDir, "dist/client");
  let raw = 0;
  let gz = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".js")) continue;
    const data = readFileSync(path.join(dir, f));
    raw += data.length;
    gz += gzipSync(data).length;
  }
  return { rawKB: raw / 1024, gzKB: gz / 1024 };
}

async function ttfb() {
  const { child } = await timeUntil(["start", appDir, "--port", "8799"], "NOWAKI_START_READY").catch(
    () => ({ child: null }),
  );
  // start は ready 後も走り続けるので、timeUntil の kill 後に別途起動して測る
  const server = spawn(bin, ["start", appDir, "--port", "8799"], { cwd: ROOT });
  let ready = false;
  server.stdout.on("data", (b) => {
    if (b.toString().includes("NOWAKI_START_READY")) ready = true;
  });
  for (let i = 0; i < 60 && !ready; i++) await sleep(100);
  await sleep(200);
  const t0 = now();
  let ms = null;
  try {
    const res = await fetch("http://127.0.0.1:8799/");
    await res.text();
    ms = now() - t0;
  } catch {
    /* ignore */
  }
  server.kill("SIGKILL");
  if (child) child.kill?.("SIGKILL");
  return ms;
}

console.log(`# Nowaki benchmarks\n`);
console.log(`app: \`${path.relative(ROOT, appDir)}\`  ·  bin: \`${path.relative(ROOT, bin)}\`\n`);

const dev = await devReady();
const build = buildTime();
const js = shippedJs();
const ttfbMs = await ttfb();

const rows = [
  ["dev server ready (cold)", `${dev.cold.toFixed(0)} ms`],
  ["dev server ready (warm cache)", `${dev.warm.toFixed(0)} ms`],
  ["production build", `${build.toFixed(0)} ms`],
  ["shipped client JS (gzip)", `${js.gzKB.toFixed(1)} KB`],
  ["shipped client JS (raw)", `${js.rawKB.toFixed(1)} KB`],
  ["TTFB (nowaki start, /)", ttfbMs == null ? "n/a" : `${ttfbMs.toFixed(0)} ms`],
];
console.log("| metric | value |");
console.log("|---|---|");
for (const [k, v] of rows) console.log(`| ${k} | ${v} |`);
console.log("");
clean();
process.exit(0);
