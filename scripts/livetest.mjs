// Jetstream（サーバーリアクティブ島）の WS e2e。Node 22+ の global WebSocket を使う。
// 検証: (1) join → presence、(2) event → patch（カウンタ往復）、(3) 2接続目で presence が増える、
//       (4) 切断で presence が戻る。
//
// 使い方: node scripts/livetest.mjs <baseUrl>   例: node scripts/livetest.mjs http://127.0.0.1:3300

const base = process.argv[2] ?? "http://127.0.0.1:3300";
const wsUrl = base.replace(/^http/, "ws") + "/__nowaki/live";

// /live ページから LiveCounter の nid と初期 state を拾う。
const html = await (await fetch(base + "/live")).text();
const m = html.match(/<nowaki-live name="LiveCounter" nid="([^"]+)" state="([^"]*)"/);
if (!m) {
  console.error("FAIL: <nowaki-live> が /live に見つかりません");
  process.exit(1);
}
const nid = m[1];
const state = JSON.parse(m[2].replace(/&quot;/g, '"'));
console.log(`live island nid=${nid} state=${JSON.stringify(state)}`);

const recvUntil = (ws, pred, timeout = 5000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), timeout);
    const on = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (pred(msg)) {
        clearTimeout(t);
        ws.removeEventListener("message", on);
        resolve(msg);
      }
    };
    ws.addEventListener("message", on);
  });

const open = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });

let failed = false;
const check = (cond, label) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failed = true;
};

// 接続1: join → presence ≥ 1
const a = await open(wsUrl);
const p1 = await recvUntil(a, (m) => m.type === "presence");
check(p1.count >= 1, `presence after first connect (count=${p1.count})`);

a.send(JSON.stringify({ type: "join", islands: [{ nid, name: "LiveCounter", state }] }));

// event（inc）→ patch。LiveCounter は count を +1 する（live: 0 → live: 1）。
a.send(JSON.stringify({ type: "event", nid, handler: "inc" }));
const patch = await recvUntil(a, (m) => m.type === "patch" && m.nid === nid);
check(/live:\s*1/.test(patch.html), `patch reflects incremented count (html has "live: 1")`);

// 接続2 → presence が増える（接続1 が presence 更新を受ける）。
const b = await open(wsUrl);
const p2 = await recvUntil(a, (m) => m.type === "presence" && m.count >= 2);
check(p2.count >= 2, `presence rises on second connect (count=${p2.count})`);

// 接続2 を閉じる → presence が戻る。
b.close();
const p3 = await recvUntil(a, (m) => m.type === "presence" && m.count < p2.count);
check(p3.count < p2.count, `presence falls after disconnect (count=${p3.count})`);

a.close();
console.log(failed ? "\nLIVETEST FAILED" : "\nLIVETEST PASSED");
process.exit(failed ? 1 : 0);
