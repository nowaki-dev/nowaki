// LoaderContext: loader / action / middleware / API ハンドラに渡る共通コンテキスト。
// リクエスト（url, params, method, headers, cookies, body）と、レスポンスへの
// 書き込み（status, header, cookie, redirect, json, …）をまとめる。

export function makeContext(info) {
  const { url, params = {}, method = "GET", req } = info;
  // headers / readBody は呼び出し側が注入できる（Node: req から、Edge: Web Request から）。
  const reqHeaders = info.headers ?? req?.headers ?? {};
  const readBodyFn = info.readBody ?? (() => readBodyNode(req));
  const cookies = parseCookies(reqHeaders["cookie"] ?? "");
  const resHeaders = new Map();
  const setCookies = [];

  const ctx = {
    url,
    params,
    method,
    req,
    headers: reqHeaders, // リクエストヘッダ（小文字キー）
    cookies, // パース済みリクエスト Cookie
    resHeaders, // レスポンスヘッダ（書き込み用）
    resStatus: undefined,
    actionData: undefined,
    state: {}, // ミドルウェアが loader/ページへ渡す任意データ

    // リクエスト側
    get(name) {
      return reqHeaders[String(name).toLowerCase()];
    },
    async formData() {
      const buf = await readBodyFn();
      return parseFormBody(buf, reqHeaders["content-type"] ?? "");
    },
    async bodyText() {
      return decodeBody(await readBodyFn());
    },
    async bodyJson() {
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
