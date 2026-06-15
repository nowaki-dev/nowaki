// Jetstream の N 並列接続の実測。Node 22+ の global WebSocket を使う。
// 測るもの: (1) N 接続を張る時間、(2) 接続時のサーバー RSS 増分（= 1 接続あたりの常駐コスト）、
//          (3) イベント処理スループット（events/sec, 各接続が inc を送り patch を受けるまで）。
//
// 使い方: node scripts/live-loadtest.mjs <baseUrl> <N> <rustPid> <sidecarPid>
//   例: node scripts/live-loadtest.mjs http://127.0.0.1:8200 1000 12345 12346

import { execSync } from "node:child_process";

const base = process.argv[2];
const N = Number.parseInt(process.argv[3] ?? "1000", 10);
const pids = process.argv.slice(4).filter(Boolean);
const wsUrl = base.replace(/^http/, "ws") + "/__nowaki/live";
const now = () => Number(process.hrtime.bigint() / 1000000n);

const rssKB = () => {
  let total = 0;
  for (const p of pids) {
    try {
      total += Number.parseInt(execSync(`ps -o rss= -p ${p}`).toString().trim(), 10) || 0;
    } catch {}
  }
  return total;
};

// /live から LiveCounter の nid / 初期 state / 署名(sig)を拾う（属性順に依らず）。
const html = await (await fetch(base + "/live")).text();
const tag = html.match(/<nowaki-live\b[^>]*>/)?.[0];
if (!tag || !/name="LiveCounter"/.test(tag)) {
  console.error("no <nowaki-live> on /live");
  process.exit(1);
}
const attr = (n) => tag.match(new RegExp(`${n}="([^"]*)"`))?.[1];
const nid = attr("nid");
const state = JSON.parse((attr("state") ?? "{}").replace(/&quot;/g, '"'));
const sig = attr("sig") ?? "";

const open = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws), { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

const baseRss = rssKB();
console.log(`baseline RSS: ${(baseRss / 1024).toFixed(1)} MB  (pids ${pids.join(",")})`);

// --- N 接続を並列で張る（バッチで FD/受け入れの瞬間ピークを抑える）---
const t0 = now();
const conns = [];
const BATCH = 100;
for (let i = 0; i < N; i += BATCH) {
  const batch = await Promise.allSettled(
    Array.from({ length: Math.min(BATCH, N - i) }, () => open(wsUrl)),
  );
  for (const r of batch) if (r.status === "fulfilled") conns.push(r.value);
}
const connMs = now() - t0;
// join を送る（接続ごとに独立した state を持たせる）
for (const ws of conns) {
  ws.send(JSON.stringify({ type: "join", islands: [{ nid, name: "LiveCounter", state, sig }] }));
}
await new Promise((r) => setTimeout(r, 1500)); // 安定待ち（presence 配信など）
const afterRss = rssKB();

console.log(`opened ${conns.length}/${N} connections in ${connMs} ms`);
console.log(
  `RSS after connect: ${(afterRss / 1024).toFixed(1)} MB  ` +
    `(+${((afterRss - baseRss) / 1024).toFixed(1)} MB, ~${(((afterRss - baseRss) * 1024) / conns.length / 1024).toFixed(1)} KB/conn)`,
);

// --- イベントスループット: 全接続が inc を送り、patch を数える ---
let patches = 0;
for (const ws of conns) {
  ws.addEventListener("message", (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.type === "patch") patches++;
  });
}
const te = now();
for (const ws of conns) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type: "event", nid, handler: "inc" }));
}
// patch が出そろうまで待つ（最大 20s）
for (let i = 0; i < 200 && patches < conns.length; i++) await new Promise((r) => setTimeout(r, 100));
const evMs = now() - te;
console.log(
  `events: ${conns.length} inc sent → ${patches} patches in ${evMs} ms  ` +
    `(${Math.round((patches / evMs) * 1000)} renders/sec)`,
);

for (const ws of conns) ws.close();
process.exit(0);
