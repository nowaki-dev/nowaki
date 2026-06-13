// Nowaki vs Next.js vs Astro の head-to-head。同条件の「カウンタ1個 + SSR」アプリを
// benchmarks/apps/{nowaki,next,astro}-counter に置き、同じ指標で測る。
//
// 正直さの原則: 各フレームワークの toolchain（node_modules）が入っているものだけ測る。
// 入っていなければ "not installed" と表示し、数字を捏造しない。Next/Astro を測るには:
//   pnpm -C benchmarks/apps/next-counter  install
//   pnpm -C benchmarks/apps/astro-counter install
// （Nowaki は monorepo の pnpm install でリンクされる。）
//
// 使い方: node benchmarks/head-to-head.mjs [--json]
//
// 指標:
//   dev ready (cold)  — dev サーバー起動 → ready 行までの wall time
//   build            — 本番ビルドの wall time
//   client JS (gzip) — ページが読み込むクライアント JS の gzip 合計（小さいほど良い）

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const APPS = path.join(ROOT, "benchmarks/apps");
const JSON_OUT = process.argv.includes("--json");
const now = () => Number(process.hrtime.bigint() / 1000000n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const nowakiBin = existsSync(path.join(ROOT, "target/release/nowaki"))
  ? path.join(ROOT, "target/release/nowaki")
  : path.join(ROOT, "target/debug/nowaki");

// dir 以下の *.js を再帰的に集計。{ rawKB, gzKB } を返す（生の minified バイトと gzip）。
function jsSize(dir, keep = () => true) {
  if (!existsSync(dir)) return { rawKB: 0, gzKB: 0 };
  let raw = 0;
  let gz = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js") && keep(p)) {
        const data = readFileSync(p);
        raw += data.length;
        gz += gzipSync(data).length;
      }
    }
  };
  walk(dir);
  return { rawKB: raw / 1024, gzKB: gz / 1024 };
}

// cmd を起動し、stdout/stderr に marker が出るまでの wall time（ms）を返す。kill する。
function timeUntil(cmd, args, opts, marker, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const t0 = now();
    const child = spawn(cmd, args, { ...opts, env: { ...process.env, ...(opts.env ?? {}) } });
    let done = false;
    const finish = (ms) => {
      if (done) return;
      done = true;
      try {
        child.kill("SIGKILL");
      } catch {}
      resolve(ms);
    };
    const onData = (buf) => {
      if (!done && buf.toString().toLowerCase().includes(marker.toLowerCase())) finish(now() - t0);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", () => finish(null));
    setTimeout(() => finish(null), timeoutMs);
  });
}

// cmd を最後まで走らせ、{ ms, stdout }（失敗時 ms=null）を返す。
function timeRun(cmd, args, opts) {
  const t0 = now();
  const r = spawnSync(cmd, args, {
    ...opts,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(opts.env ?? {}) },
  });
  return { ms: r.status === 0 ? now() - t0 : null, stdout: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function clean(dir, subs) {
  for (const s of subs) rmSync(path.join(dir, s), { recursive: true, force: true });
}

// --- Nowaki ---
async function benchNowaki() {
  const dir = path.join(APPS, "nowaki-counter");
  const runtimeLinked =
    existsSync(path.join(dir, "node_modules/@nowaki-dev/runtime")) &&
    existsSync(path.join(dir, "node_modules/preact"));
  if (!runtimeLinked) return { name: "Nowaki", skip: "deps not linked (run `pnpm install` at repo root)" };

  clean(dir, ["dist", "node_modules/.cache/nowaki"]);
  const dev = await timeUntil(nowakiBin, ["dev", dir, "--port", "0"], { cwd: ROOT }, "dev server ready");
  clean(dir, ["dist", "node_modules/.cache/nowaki"]);
  const build = timeRun(nowakiBin, ["build", dir], { cwd: ROOT });
  const js = jsSize(path.join(dir, "dist/client"));
  clean(dir, ["dist"]);
  return { name: "Nowaki", dev, build: build.ms, rawKB: js.rawKB, gzKB: js.gzKB };
}

// --- Next.js ---
async function benchNext() {
  const dir = path.join(APPS, "next-counter");
  const bin = path.join(dir, "node_modules/.bin/next");
  if (!existsSync(bin)) return { name: "Next.js", skip: "not installed (`pnpm -C benchmarks/apps/next-counter install`)" };
  const env = { NEXT_TELEMETRY_DISABLED: "1" };

  clean(dir, [".next"]);
  const dev = await timeUntil(bin, ["dev", "-p", "8911"], { cwd: dir, env }, "ready in");
  clean(dir, [".next"]);
  const build = timeRun(bin, ["build"], { cwd: dir, env });
  // first-load JS は Next 自身の `next build` 出力（ルート表の `/` 行の最終列）を採る。
  // これは「`/` が実際に最初に読む JS」の Next 公式値（parsed, 未圧縮）。
  let firstLoadKB = null;
  const m = build.stdout.match(/[┌├└]\s*[○●ƒλ]?\s*\/\s+\S+\s+(?:k?B\s+)?([\d.]+)\s*kB/);
  if (m) firstLoadKB = parseFloat(m[1]);
  else {
    const shared = build.stdout.match(/First Load JS shared by all\s+([\d.]+)\s*kB/);
    if (shared) firstLoadKB = parseFloat(shared[1]);
  }
  clean(dir, [".next"]);
  // Next の first-load は未圧縮の Next 公式値なので rawKB に入れる（gzip は出さない）。
  return { name: "Next.js", dev, build: build.ms, rawKB: firstLoadKB, gzKB: null, rawNote: "Next-reported First Load JS" };
}

// --- Astro ---
async function benchAstro() {
  const dir = path.join(APPS, "astro-counter");
  const bin = path.join(dir, "node_modules/.bin/astro");
  if (!existsSync(bin)) return { name: "Astro", skip: "not installed (`pnpm -C benchmarks/apps/astro-counter install`)" };

  clean(dir, ["dist", ".astro"]);
  const dev = await timeUntil(bin, ["dev", "--port", "8912"], { cwd: dir }, "ready in");
  clean(dir, ["dist", ".astro"]);
  const build = timeRun(bin, ["build"], { cwd: dir });
  const js = jsSize(path.join(dir, "dist")); // Astro は island JS だけを dist/_astro に出す
  clean(dir, ["dist", ".astro"]);
  return { name: "Astro", dev, build: build.ms, rawKB: js.rawKB, gzKB: js.gzKB };
}

const results = [];
results.push(await benchNowaki());
results.push(await benchNext());
results.push(await benchAstro());

if (JSON_OUT) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

const fmt = (v, unit) => (v == null ? "n/a" : `${v.toFixed(unit === "KB" ? 1 : 0)} ${unit}`);
console.log("# Head-to-head: Nowaki vs Next.js vs Astro\n");
console.log("Same app (one counter island + SSR), same machine. Lower is better.\n");
console.log("| framework | dev ready (cold) | build | first-load JS (raw) | first-load JS (gzip) |");
console.log("|---|---|---|---|---|");
for (const r of results) {
  if (r.skip) {
    console.log(`| ${r.name} | _${r.skip}_ | | | |`);
  } else {
    const raw = r.rawKB == null ? "n/a" : `${r.rawKB.toFixed(1)} KB${r.rawNote ? "*" : ""}`;
    const gz = r.gzKB == null ? "—" : `${r.gzKB.toFixed(1)} KB`;
    console.log(`| ${r.name} | ${fmt(r.dev, "ms")} | ${fmt(r.build, "ms")} | ${raw} | ${gz} |`);
  }
}
console.log("");
if (results.some((r) => r.rawNote)) {
  console.log("\\* Next-reported First Load JS (parsed, uncompressed) from `next build`; gzip not summed for Next.\n");
}
console.log("Reproduce: install the peers, then `node benchmarks/head-to-head.mjs`.");
process.exit(0);
