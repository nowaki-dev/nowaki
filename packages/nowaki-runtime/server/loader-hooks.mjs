// Node module loader hooks (module.register で別スレッドに登録される)
// 役割: .tsx/.ts を Rust devサーバーの変換エンドポイントから取得してESMとして返す。
// 変換器をRust一本に統一するための仕掛け (vite-node方式)。

const RUST = `http://127.0.0.1:${process.env.NOWAKI_RUST_PORT ?? "3000"}`;
const TS_RE = /\.(tsx|ts|jsx)$/;

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  // 親モジュールの ?v= (HMR世代) を相対importへ伝播し、変更後の再評価を強制する
  if (context.parentURL && result.url.startsWith("file:")) {
    const parentV = safeParam(context.parentURL, "v");
    if (parentV) {
      const url = new URL(result.url);
      if (TS_RE.test(url.pathname) && !url.searchParams.get("v")) {
        url.searchParams.set("v", parentV);
        return { ...result, url: url.href, shortCircuit: true };
      }
    }
  }
  return result;
}

export async function load(url, context, nextLoad) {
  const u = new URL(url);
  if (u.protocol === "file:" && TS_RE.test(u.pathname)) {
    const v = u.searchParams.get("v") ?? "0";
    const endpoint = `${RUST}/__nowaki/ssr-module?path=${encodeURIComponent(u.pathname)}&v=${v}`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error(`[nowaki] SSR変換に失敗 (${u.pathname}): ${await res.text()}`);
    }
    return { format: "module", source: await res.text(), shortCircuit: true };
  }
  return nextLoad(url, context);
}

function safeParam(href, key) {
  try {
    return new URL(href).searchParams.get(key);
  } catch {
    return null;
  }
}
