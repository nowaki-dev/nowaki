// プラグインホスト。Rust（dev/build）から起動され、アプリの nowaki.config を読み込んで
// プラグインの変換フックを HTTP で提供する。Rust は変換可能モジュールのソースをここへ渡し、
// 変換後コードを受け取る（マッチしなければ素通し）。起動完了は stdout の
// "NOWAKI_PLUGIN_HOST_READY <port>" で通知する。
//
// nowaki.config.mjs（または .js）:
//   export default {
//     plugins: [
//       { name: "my-plugin", transform(code, id) { return code.replaceAll("__X__", "1"); } },
//     ],
//   };

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const appRoot = process.cwd();

async function loadConfig() {
  for (const name of ["nowaki.config.mjs", "nowaki.config.js"]) {
    const p = path.join(appRoot, name);
    if (existsSync(p)) {
      const mod = await import(pathToFileURL(p).href);
      return mod.default ?? mod.config ?? {};
    }
  }
  return {};
}

const config = await loadConfig();
const plugins = (config.plugins ?? []).filter((p) => p && typeof p === "object");
const transformers = plugins.filter((p) => typeof p.transform === "function");

// TSRX: アプリに @tsrx/preact があれば .tsrx を標準 JSX へコンパイルできる。
// 解決は「アプリの node_modules」基準（このホスト自体は runtime パッケージ配下にあるため）。
let tsrxCompile = null;
try {
  const appRequire = createRequire(path.join(appRoot, "package.json"));
  const resolved = appRequire.resolve("@tsrx/preact");
  const mod = await import(pathToFileURL(resolved).href);
  if (typeof mod.compile === "function") tsrxCompile = mod.compile;
} catch {
  // 未導入なら .tsrx 非対応（hasTsrx=false）
}

// 各プラグインの transform を順に適用（前段の出力を次段へ）。誰も変えなければ null。
async function runTransform(id, code) {
  let current = code;
  let changed = false;
  for (const p of transformers) {
    const out = await p.transform(current, id);
    if (out == null) continue;
    const next = typeof out === "string" ? out : out.code;
    if (typeof next === "string" && next !== current) {
      current = next;
      changed = true;
    }
  }
  return changed ? current : null;
}

// Content-Length を明示して送る（Rust 側の素朴な HTTP クライアントが chunked を扱わずに済む）。
function sendJson(res, status, obj) {
  const json = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(json),
  });
  res.end(json);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/caps") {
      sendJson(res, 200, { hasTransform: transformers.length > 0, hasTsrx: !!tsrxCompile });
      return;
    }
    if (url.pathname === "/transform" && req.method === "POST") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const { id, code } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const out = await runTransform(id, code);
      sendJson(res, 200, { code: out });
      return;
    }
    if (url.pathname === "/tsrx" && req.method === "POST") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const { id, code } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      let out = null;
      if (tsrxCompile) {
        const r = tsrxCompile(code, { filename: id });
        if (r?.errors?.length) {
          sendJson(res, 200, { code: null, error: JSON.stringify(r.errors) });
          return;
        }
        out = r?.code ?? null;
      }
      sendJson(res, 200, { code: out });
      return;
    }
    res.writeHead(404).end();
  } catch (err) {
    sendJson(res, 500, { error: String(err?.stack ?? err) });
  }
});

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  console.log(`NOWAKI_PLUGIN_HOST_READY ${port}`);
  console.error(
    `[nowaki] plugin host: ${plugins.length} plugin(s), ${transformers.length} transform hook(s), tsrx=${!!tsrxCompile}`,
  );
});
