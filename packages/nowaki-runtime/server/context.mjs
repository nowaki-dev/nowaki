// LoaderContext: loader / action / middleware / API ハンドラに渡る共通コンテキスト。
// リクエスト（url, params, method, headers, cookies, body）と、レスポンスへの
// 書き込み（status, header, cookie, redirect, json, …）をまとめる。

export function makeContext(info) {
  const { url, params = {}, method = "GET", req } = info;
  // headers / readBody は呼び出し側が注入できる（Node: req から、Edge: Web Request から）。
  const reqHeaders = info.headers ?? req?.headers ?? {};
  const readBodyFn = info.readBody ?? (() => readBodyNode(req));
  const resHeaders = new Map();
  const setCookies = [];

  // ISR の Vary 追跡: この描画が「どのリクエストヘッダ / クエリ」に依存したかを記録し、
  // ctx.__vary() で公開する。start.rs はこれをキャッシュキーへ織り込み、(a) ヘッダ依存ページが
  // クロスユーザーに漏れる #6 と、(b) 未使用クエリ氾濫でキャッシュが追い出される #7 を防ぐ。
  const accessedHeaders = new Set();
  let queryAccessed = false;
  let reqAccessed = false; // 生 req に触れたら粒度不明なのでキャッシュ無効化（"*"）扱い
  const noteHeader = (name) => accessedHeaders.add(String(name).toLowerCase());

  // url は「クエリを露出し得る」あらゆる参照で「クエリ依存」を記録する Proxy で包む。
  // 許可リスト方式（href/toString/… を列挙）は toLocaleString のような継承メソッドを
  // 取りこぼし、クエリ依存ページがクエリ無視キーで共有されてクロスユーザー漏れになる。
  // そこで「クエリを露出しないと確定したメンバ(QUERY_FREE)以外は、クエリが存在する限り
  // 全てクエリ依存とみなす」安全側デフォルトにする（未知メソッド/Symbol も網羅）。
  // 内部のルート一致(matchRoute)は生の info.url を使い、フレームワークは ctx.url を
  // .pathname でしか参照しないので、記録されるのはユーザーコードのクエリ露出のみ。
  const QUERY_FREE = new Set([
    "pathname",
    "hostname",
    "host",
    "origin",
    "protocol",
    "port",
    "hash",
    "username",
    "password",
  ]);
  const urlProxy = new Proxy(url, {
    get(target, prop) {
      if (prop === "search" || prop === "searchParams") {
        queryAccessed = true;
      } else if (target.search && !(typeof prop === "string" && QUERY_FREE.has(prop))) {
        // クエリ有り + query-free 確定メンバ以外（href/toString/toLocaleString/`${url}`/
        // toJSON/未知メソッド/Symbol）→ クエリ依存とみなす。
        queryAccessed = true;
      }
      // getter / メソッドは実体(target)を receiver にして呼ぶ（URL の private field を壊さない）。
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });

  let cookiesCache;

  const ctx = {
    url: urlProxy,
    params,
    method,
    // 生 req（Node IncomingMessage）に触れるとヘッダ/クエリ参照を追跡できないので、
    // 触れた時点で「全依存」とみなし ISR キャッシュを無効化する（per-user 内容の漏れ防止）。
    get req() {
      reqAccessed = true;
      return req;
    },
    // 生ヘッダの直接参照は粒度が取れないので「全ヘッダ依存」とみなす（保守的にキャッシュ無効化）。
    get headers() {
      noteHeader("*");
      return reqHeaders;
    },
    // Cookie 参照は「cookie ヘッダ依存」として記録（per-user 内容の取り違えを防ぐ）。
    get cookies() {
      if (!cookiesCache) cookiesCache = parseCookies(reqHeaders["cookie"] ?? "");
      noteHeader("cookie");
      return cookiesCache;
    },
    resHeaders, // レスポンスヘッダ（書き込み用）
    resStatus: undefined,
    actionData: undefined,
    state: {}, // ミドルウェアが loader/ページへ渡す任意データ

    // この描画の Vary 情報（handler.mjs が ISR 応答ヘッダへ載せる）。
    // 生 req に触れていたら "*"（全依存）を立てて Rust 側で no_cache にさせる。
    __vary() {
      const headers = reqAccessed ? ["*"] : [...accessedHeaders];
      return { query: queryAccessed, headers };
    },

    // リクエスト側
    get(name) {
      noteHeader(name);
      return reqHeaders[String(name).toLowerCase()];
    },
    async formData() {
      reqAccessed = true; // 本文/Content-Type 依存 → ISR 共有キャッシュ不可（per-user 取り違え防止）
      const buf = await readBodyFn();
      return parseFormBody(buf, reqHeaders["content-type"] ?? "");
    },
    async bodyText() {
      reqAccessed = true;
      return decodeBody(await readBodyFn());
    },
    async bodyJson() {
      reqAccessed = true;
      const s = decodeBody(await readBodyFn());
      return s ? JSON.parse(s) : null;
    },

    // レスポンス側（チェーン可能）
    status(code) {
      ctx.resStatus = code;
      return ctx;
    },
    setHeader(name, value) {
      resHeaders.set(name, value);
      return ctx;
    },
    setCookie(name, value, opts = {}) {
      setCookies.push(serializeCookie(name, value, opts));
      return ctx;
    },
    deleteCookie(name, opts = {}) {
      setCookies.push(serializeCookie(name, "", { ...opts, maxAge: 0 }));
      return ctx;
    },
    collectSetCookies() {
      return setCookies;
    },

    // 結果ヘルパ（loader/action/middleware/API から返す）
    redirect(to, status = 302) {
      const res = { __nowakiResult: true, status, headers: { location: to }, body: "" };
      ctx._redirect = res; // throw 経路でも拾えるよう保持
      return res;
    },
    json(data, init = {}) {
      return result(init.status ?? 200, "application/json; charset=utf-8", JSON.stringify(data), init.headers);
    },
    html(markup, init = {}) {
      return result(init.status ?? 200, "text/html; charset=utf-8", String(markup), init.headers);
    },
    text(s, init = {}) {
      return result(init.status ?? 200, "text/plain; charset=utf-8", String(s), init.headers);
    },
  };
  return ctx;
}

function result(status, contentType, body, extra) {
  return { __nowakiResult: true, status, headers: { "content-type": contentType, ...(extra ?? {}) }, body };
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function serializeCookie(name, value, opts) {
  let s = `${name}=${encodeURIComponent(value)}`;
  if (opts.maxAge !== undefined) s += `; Max-Age=${Math.floor(opts.maxAge)}`;
  if (opts.expires) s += `; Expires=${opts.expires instanceof Date ? opts.expires.toUTCString() : opts.expires}`;
  s += `; Path=${opts.path ?? "/"}`;
  if (opts.domain) s += `; Domain=${opts.domain}`;
  if (opts.httpOnly !== false) s += "; HttpOnly";
  if (opts.secure) s += "; Secure";
  s += `; SameSite=${opts.sameSite ?? "Lax"}`;
  return s;
}

// Node の IncomingMessage からボディを集める（Edge は info.readBody を注入する）。
function readBodyNode(req) {
  return new Promise((resolve, reject) => {
    if (!req || typeof req.on !== "function") return resolve(new Uint8Array(0));
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Buffer / Uint8Array / string いずれも UTF-8 文字列へ（Edge には Buffer が無い）。
function decodeBody(buf) {
  if (typeof buf === "string") return buf;
  return new TextDecoder().decode(buf);
}

// application/x-www-form-urlencoded を URLSearchParams で返す。multipart は未対応。
function parseFormBody(buf, contentType) {
  const text = decodeBody(buf);
  if (contentType.includes("multipart/form-data")) {
    throw new Error("multipart/form-data はまだ未対応です（urlencoded を使ってください）");
  }
  return new URLSearchParams(text);
}
