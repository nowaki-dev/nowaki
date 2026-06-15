// アプリ層セキュリティの回帰スイート。多段監査(4ラウンド)で直した防御が
// 退行していないかを決定的に検証する(Chrome 不要、curl/WS のみ)。CI の e2e から呼ぶ。
//
//   node scripts/security-e2e.mjs dev  <devBase>  <appRoot>
//   node scripts/security-e2e.mjs prod <prodBase>
//
// 検証対象: 任意ファイル読取(@fs/ssr-module/.env/virtual ..)、RPC CSRF、CSWSH、
//           live state 偽造、ISR クロスユーザー隔離・クエリ氾濫集約。

import http from "node:http";

const [mode, base, appRoot] = process.argv.slice(2);
let fails = 0;
const check = (label, cond) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) fails++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const statusOf = async (url, opts) => (await fetch(url, opts)).status;

// パスをそのまま送る GET（fetch は `..` を正規化するので生 http を使う）。
function rawGet(b, path) {
  const u = new URL(b);
  return new Promise((resolve) => {
    const req = http.request(
      { host: u.hostname, port: u.port, path, method: "GET" },
      (res) => { res.resume(); resolve(res.statusCode); },
    );
    req.on("error", () => resolve(0));
    req.end();
  });
}

// WebSocket upgrade を試みる。101=昇格、403等=拒否。Origin を任意に指定できる。
function wsUpgrade(b, path, origin) {
  const u = new URL(b);
  return new Promise((resolve) => {
    const req = http.request({
      host: u.hostname, port: u.port, path, method: "GET",
      headers: {
        Connection: "Upgrade", Upgrade: "websocket",
        "Sec-WebSocket-Key": "AAAAAAAAAAAAAAAAAAAAAA==",
        "Sec-WebSocket-Version": "13", Origin: origin,
      },
    });
    req.on("upgrade", (_res, socket) => { socket.destroy(); resolve(101); });
    req.on("response", (res) => { res.resume(); resolve(res.statusCode); });
    req.on("error", () => resolve(0));
    req.end();
  });
}

// 偽造 live join が patch を返さない（署名検証で弾かれる）ことを確認。
// global WebSocket は Origin 無しで張る(=ws_origin_ok 許可)→ 署名のみを検証。
async function liveForgeryRejected(b) {
  const html = await (await fetch(`${b}/live`)).text();
  const tag = html.match(/<nowaki-live\b[^>]*>/)?.[0];
  if (!tag) return false;
  const attr = (n) => tag.match(new RegExp(`${n}="([^"]*)"`))?.[1];
  const nid = attr("nid");
  const name = attr("name");
  const wsUrl = b.replace(/^http/, "ws") + "/__nowaki/live";
  return await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let gotPatch = false;
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({
        type: "join",
        islands: [{ nid, name, state: { count: 9999 }, sig: "FORGED" }],
      }));
      setTimeout(() => ws.send(JSON.stringify({ type: "event", nid, handler: "inc" })), 120);
    });
    ws.addEventListener("message", (e) => {
      try { if (JSON.parse(e.data).type === "patch") gotPatch = true; } catch {}
    });
    setTimeout(() => { ws.close(); resolve(!gotPatch); }, 900);
  });
}

if (mode === "dev") {
  const enc = encodeURIComponent;
  // --- 任意ファイル読取面（canonicalize + allow-root + deny + transformable ゲート） ---
  check("@fs arbitrary read blocked (/etc/passwd → 403)",
    (await statusOf(`${base}/@fs/etc/passwd`)) === 403);
  check("@fs .env blocked (403)",
    (await statusOf(`${base}/@fs${appRoot}/.env`)) === 403);
  check("ssr-module arbitrary read blocked (/etc/passwd → 403)",
    (await statusOf(`${base}/__nowaki/ssr-module?path=${enc("/etc/passwd")}`)) === 403);
  check("ssr-module .env blocked (403)",
    (await statusOf(`${base}/__nowaki/ssr-module?path=${enc(appRoot + "/.env")}`)) === 403);
  check("ssr-module legit module still served (200)",
    (await statusOf(`${base}/__nowaki/ssr-module?path=${enc(appRoot + "/routes/index.tsx")}`)) === 200);
  const envRes = await fetch(`${base}/.env`);
  const envBody = await envRes.text();
  check(".env not served via dev fallback (no secret leaked)",
    envRes.status !== 200 && !envBody.includes("SESSION_SECRET"));
  check("virtual-module traversal rejected (.. → 404)",
    (await rawGet(base, "/__nowaki_virtual__/../../../../../../../etc/hosts")) === 404);

  // --- サーバー関数 RPC の CSRF ゲート ---
  const fn = `${base}/__nowaki/fn`;
  const post = (h) =>
    fetch(fn, { method: "POST", headers: h, body: JSON.stringify({ id: "6c90d7dc921a9a3f", args: [] }) })
      .then((r) => r.status);
  check("RPC text/plain rejected (415)", (await post({ "content-type": "text/plain" })) === 415);
  check("RPC missing x-nowaki-rpc rejected (403)",
    (await post({ "content-type": "application/json" })) === 403);
  check("RPC cross-origin rejected (403)",
    (await post({ "content-type": "application/json", "x-nowaki-rpc": "1", origin: "http://evil.test" })) === 403);

  // --- CSWSH（WS upgrade の Origin 検証） ---
  check("CSWSH /__nowaki/live cross-origin upgrade rejected (403)",
    (await wsUpgrade(base, "/__nowaki/live", "http://evil.test")) === 403);
  check("CSWSH /__nowaki/hmr cross-origin upgrade rejected (403)",
    (await wsUpgrade(base, "/__nowaki/hmr", "http://evil.test")) === 403);
  check("WS same-origin upgrade allowed (101)",
    (await wsUpgrade(base, "/__nowaki/live", base)) === 101);

  // --- live state 偽造 ---
  check("forged live join is rejected (no patch)", await liveForgeryRejected(base));
}

if (mode === "prod") {
  // --- ISR クロスユーザー隔離（accept-language 依存ルート /vary） ---
  const get = (lang) =>
    fetch(`${base}/vary`, { headers: { "accept-language": lang } });
  await get("de-DE"); // 1回目: de variant を学習・保存
  const en = await get("en-US");
  const enBody = await en.text();
  const de2 = await get("de-DE");
  check("ISR isolates per accept-language (en is not served de's cache)",
    enBody.includes("en-US") && !enBody.includes("de-DE"));
  check("ISR variant is cached on repeat (HIT/STALE)",
    /HIT|STALE/.test(de2.headers.get("x-nowaki-cache") || ""));

  // --- ISR クエリ氾濫集約（/isr はクエリを読まない→ ?cb は単一エントリに集約） ---
  await fetch(`${base}/isr`); // populate
  const f1 = (await fetch(`${base}/isr?cb=1`)).headers.get("x-nowaki-cache");
  const f2 = (await fetch(`${base}/isr?cb=2`)).headers.get("x-nowaki-cache");
  check("ISR query-flood collapses (distinct ?cb served from one entry)",
    /HIT|STALE/.test(f1 || "") && /HIT|STALE/.test(f2 || ""));
}

console.log(fails ? `\nSECURITY-E2E FAILED (${fails})` : "\nSECURITY-E2E PASSED");
await sleep(50);
process.exit(fails ? 1 : 0);
