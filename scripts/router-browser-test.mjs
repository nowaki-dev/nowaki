// 実ブラウザ（Chrome）でのクライアントルーター挙動テスト。
//   1) SPA 遷移（body 差し替え + URL 更新）
//   2) Router Cache（再訪が再フェッチ無し）
//   3) loading 境界（遅い遷移でローディングUIが出る）
//   4) error 境界（フェッチ失敗でフォールバック表示 + reset で復帰）
//
// CI（Chrome 無し）では走らせず、手元での検証用。Chrome を CDP で直接駆動する（puppeteer 不要）。
// 使い方: BASE=http://127.0.0.1:8233 node scripts/router-browser-test.mjs
import { spawn } from "node:child_process";

const BASE = process.env.BASE || "http://127.0.0.1:8233";
const CHROME =
  process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9223;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTargets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json`);
  return res.json();
}

// 1つの CDP セッション。Runtime.evaluate でページ内 JS を実行する薄いラッパ。
class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => {
      this.ws.onopen = () => res();
      this.ws.onerror = (e) => rej(e);
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evalAsync(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: `(async () => { ${expr} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
}

let chrome;
let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures++;
};

try {
  chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=/tmp/nwk-chrome-test",
    "about:blank",
  ]);
  // CDP が立ち上がるまで待つ
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await cdpTargets();
      if (targets.length) break;
    } catch {}
    await sleep(250);
  }
  const page = targets.find((t) => t.type === "page");
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");

  // 初期ページ
  await cdp.send("Page.navigate", { url: BASE + "/" });
  await sleep(800);

  // --- 1) SPA 遷移: /about へのリンクを作って click（ルーターが横取り） ---
  await cdp.evalAsync(`
    window.__nav = (href) => { const a=document.createElement('a'); a.href=href; a.textContent=href; document.body.appendChild(a); a.click(); };
    return true;`);
  await cdp.evalAsync(`window.__nav('/about'); return true;`);
  await sleep(500);
  const afterAbout = await cdp.evalAsync(`
    return { path: location.pathname, h1: document.querySelector('h1')?.textContent || '', hasIslandRuntime: !!window.__nowakiRouter };`);
  check("SPA navigation swapped to /about", afterAbout.path === "/about" && /About/i.test(afterAbout.h1));

  // --- 2) Router Cache: 戻ってまた /about。/about のフェッチ回数が増えない ---
  await cdp.evalAsync(`history.back(); return true;`);
  await sleep(400);
  const fetchesBefore = await cdp.evalAsync(`
    return performance.getEntriesByType('resource').filter(e=>e.name.endsWith('/about')&&e.initiatorType==='fetch').length;`);
  await cdp.evalAsync(`window.__nav('/about'); return true;`);
  await sleep(400);
  const after = await cdp.evalAsync(`
    return { path: location.pathname,
      fetches: performance.getEntriesByType('resource').filter(e=>e.name.endsWith('/about')&&e.initiatorType==='fetch').length };`);
  check(
    "Router Cache served revisit without a new fetch",
    after.path === "/about" && after.fetches === fetchesBefore,
  );

  // --- 3) loading 境界: 遅い /slow への遷移で 150ms 後にローディングUIが出る ---
  await cdp.evalAsync(`history.back(); return true;`);
  await sleep(400);
  await cdp.evalAsync(`window.__nav('/slow?ms=700'); return true;`);
  await sleep(300); // 150ms 閾値は過ぎ、700ms ローダーはまだ未完
  const duringLoad = await cdp.evalAsync(`
    return { hasLoading: !!document.querySelector('[data-testid="loading"]'), hasSlow: !!document.querySelector('[data-testid="slow"]') };`);
  check("loading boundary shows during a slow navigation", duringLoad.hasLoading && !duringLoad.hasSlow);
  await sleep(800);
  const afterSlow = await cdp.evalAsync(`
    return { hasSlow: !!document.querySelector('[data-testid="slow"]'), hasLoading: !!document.querySelector('[data-testid="loading"]') };`);
  check("slow page replaces the loading boundary once loaded", afterSlow.hasSlow && !afterSlow.hasLoading);

  // --- 4) error 境界: /about へのフェッチをブロック → フォールバック表示 → reset で復帰 ---
  await cdp.evalAsync(`history.back(); return true;`);
  await sleep(400);
  // Router Cache をまたぐので、別 URL でブロックを試す（?e=1 で未キャッシュ）
  await cdp.send("Network.setBlockedURLs", { urls: ["*/about?e=1*", "*/about\\?e=1*", "*about?e=1*"] });
  await cdp.evalAsync(`window.__nav('/about?e=1'); return true;`);
  await sleep(700);
  const errState = await cdp.evalAsync(`
    return { hasError: !!document.querySelector('[data-testid="error"]'),
             msg: document.querySelector('[data-nowaki-error]')?.textContent || '',
             hasReset: !!document.querySelector('[data-nowaki-reset]') };`);
  check("error boundary shows on a failed navigation", errState.hasError && errState.hasReset && errState.msg.length > 0);
  // reset → ブロック解除して再試行 → /about?e=1 が表示
  await cdp.send("Network.setBlockedURLs", { urls: [] });
  await cdp.evalAsync(`document.querySelector('[data-nowaki-reset]').click(); return true;`);
  await sleep(700);
  const afterReset = await cdp.evalAsync(`
    return { path: location.pathname + location.search, hasAbout: /About/i.test(document.querySelector('h1')?.textContent||'') };`);
  check("reset retries and recovers the page", afterReset.hasAbout);

  console.log(`\n${failures === 0 ? "BROWSER ROUTER TEST PASSED" : `BROWSER ROUTER TEST FAILED (${failures})`}`);
} catch (err) {
  console.error("harness error:", err);
  failures++;
} finally {
  if (chrome) chrome.kill();
  process.exit(failures === 0 ? 0 : 1);
}
