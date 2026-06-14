// 遅延ハイドレーション（client:* 指令）の実ブラウザ挙動テスト。
//   client:load    即時ハイドレート（クリックで増える）
//   client:idle    アイドル後にハイドレート
//   client:only    SSR されず、クライアントで描画される
//   client:visible スクロールで可視になるまでハイドレートしない
// CI（Chrome 無し）では走らせず、手元検証用。Chrome を CDP で直接駆動する（puppeteer 不要）。
// 使い方: BASE=http://127.0.0.1:8241 node scripts/lazy-hydration-test.mjs
import { spawn } from "node:child_process";

const BASE = process.env.BASE || "http://127.0.0.1:8241";
const CHROME =
  process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9224;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
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

const HELPERS = `
  window.__plus = (testid) => { const s=document.querySelector('[data-testid="'+testid+'"]'); const b=s&&s.querySelectorAll('button'); if(b&&b.length) b[b.length-1].click(); };
  window.__count = (testid) => { const s=document.querySelector('[data-testid="'+testid+'"]'); const c=s&&s.querySelector('strong'); return c?c.textContent:null; };
  window.__onlyText = () => { const e=document.querySelector('[data-testid="client-only"]'); return e?e.textContent:''; };
`;

try {
  chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=800,600",
    "--user-data-dir=/tmp/nwk-chrome-lazy",
    "about:blank",
  ]);
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      if (targets.length) break;
    } catch {}
    await sleep(250);
  }
  const page = targets.find((t) => t.type === "page");
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: BASE + "/lazy" });
  await sleep(700);
  await cdp.evalAsync(HELPERS + " return true;");

  // --- client:load: 即時ハイドレート ---
  await cdp.evalAsync(`window.__plus('sec-load'); return true;`);
  await sleep(80);
  check("client:load hydrates immediately", (await cdp.evalAsync(`return window.__count('sec-load');`)) === "1");

  // --- client:visible: 折り返しの下なので、まだハイドレートしない ---
  await cdp.evalAsync(`window.__plus('sec-visible'); return true;`);
  await sleep(80);
  check(
    "client:visible does NOT hydrate while off-screen",
    (await cdp.evalAsync(`return window.__count('sec-visible');`)) === "100",
  );

  // --- client:idle: アイドル後にハイドレート ---
  await sleep(600);
  await cdp.evalAsync(`window.__plus('sec-idle'); return true;`);
  await sleep(80);
  check("client:idle hydrates on idle", (await cdp.evalAsync(`return window.__count('sec-idle');`)) === "11");

  // --- client:only: SSR されず、クライアントで描画（width が入る） ---
  const onlyText = (await cdp.evalAsync(`return window.__onlyText();`)) || "";
  const onlyMatch = onlyText.match(/innerWidth = (\d+)/);
  check(
    "client:only renders client-side (window.innerWidth shown)",
    !!onlyMatch && Number(onlyMatch[1]) > 0,
  );

  // --- client:visible: スクロールで可視にすると、ハイドレートする ---
  await cdp.evalAsync(`window.scrollTo(0, document.body.scrollHeight); return true;`);
  await sleep(600);
  await cdp.evalAsync(`window.__plus('sec-visible'); return true;`);
  await sleep(150);
  check(
    "client:visible hydrates after scrolling into view",
    (await cdp.evalAsync(`return window.__count('sec-visible');`)) === "101",
  );

  console.log(`\n${failures === 0 ? "LAZY HYDRATION TEST PASSED" : `LAZY HYDRATION TEST FAILED (${failures})`}`);
} catch (err) {
  console.error("harness error:", err);
  failures++;
} finally {
  if (chrome) chrome.kill();
  process.exit(failures === 0 ? 0 : 1);
}
