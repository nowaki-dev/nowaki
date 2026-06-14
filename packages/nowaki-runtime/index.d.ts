// Nowaki framework の公開型。アプリのルート・loader・action・API・サーバー関数を型付ける。
//   import type { LoaderContext, PageProps } from "@nowaki-dev/runtime";
// 値の getContext も同名でエクスポートする（import { getContext } from "@nowaki-dev/runtime"）。

/** ルートパラメータ。`[slug]` は string、`[...slug]`（catch-all）は string[]。 */
export type RouteParams = Record<string, string | string[]>;

export interface CookieOptions {
  maxAge?: number;
  expires?: Date | string;
  path?: string;
  domain?: string;
  /** 既定 true。明示的に false で HttpOnly を外す。 */
  httpOnly?: boolean;
  secure?: boolean;
  /** 既定 "Lax"。 */
  sameSite?: "Lax" | "Strict" | "None" | "lax" | "strict" | "none";
}

export interface ResponseInit {
  status?: number;
  headers?: Record<string, string>;
}

/** ctx.json / html / text / redirect が返す結果（そのまま return すると確定する）。 */
export interface NowakiResult {
  readonly __nowakiResult: true;
}

/**
 * loader / action / middleware / API ハンドラに渡る共通コンテキスト。
 * リクエスト（url・params・method・headers・cookies・body）と、レスポンスへの
 * 書き込み（status・header・cookie・redirect・json・…）をまとめる。
 */
export interface LoaderContext {
  /** リクエスト URL。 */
  readonly url: URL;
  /** ルートパラメータ（catch-all は配列）。 */
  readonly params: RouteParams;
  /** HTTP メソッド。 */
  readonly method: string;
  /** リクエストヘッダ（キーは小文字）。 */
  readonly headers: Record<string, string>;
  /** パース済みリクエスト Cookie。 */
  readonly cookies: Record<string, string>;
  /** Node の IncomingMessage（Edge では未定義）。 */
  readonly req?: unknown;
  /** ミドルウェアが loader / ページへ渡す任意データ。 */
  state: Record<string, unknown>;
  /** action の戻り値（ページ再描画時に渡る）。 */
  actionData?: unknown;

  /** リクエストヘッダを取得（大文字小文字を無視）。 */
  get(name: string): string | undefined;
  /** application/x-www-form-urlencoded のボディを URLSearchParams で。 */
  formData(): Promise<URLSearchParams>;
  /** リクエストボディを文字列で。 */
  bodyText(): Promise<string>;
  /** リクエストボディを JSON として。 */
  bodyJson<T = unknown>(): Promise<T>;

  /** レスポンスステータスを設定（チェーン可）。 */
  status(code: number): this;
  /** レスポンスヘッダを設定（チェーン可）。 */
  setHeader(name: string, value: string): this;
  /** Set-Cookie を積む（チェーン可）。 */
  setCookie(name: string, value: string, opts?: CookieOptions): this;
  /** Cookie を削除（Max-Age=0、チェーン可）。 */
  deleteCookie(name: string, opts?: CookieOptions): this;

  /** リダイレクト（既定 302）。loader/action/middleware から return する。 */
  redirect(to: string, status?: number): NowakiResult;
  /** JSON レスポンスを返す。 */
  json<T>(data: T, init?: ResponseInit): NowakiResult;
  /** HTML レスポンスを返す。 */
  html(markup: string, init?: ResponseInit): NowakiResult;
  /** text/plain レスポンスを返す。 */
  text(s: string, init?: ResponseInit): NowakiResult;
}

/** サーバー専用の loader。戻り値はページに `data` として渡る。 */
export type Loader<T = unknown> = (ctx: LoaderContext) => T | Promise<T>;

/** 非 GET リクエストで走る action。Response/redirect か、再描画用データを返す。 */
export type Action = (ctx: LoaderContext) => unknown | Promise<unknown>;

/** API ルートのハンドラ（メソッド別 export または default）。 */
export type ApiHandler = (
  ctx: LoaderContext,
) => Response | NowakiResult | unknown | Promise<Response | NowakiResult | unknown>;

/** ミドルウェア。Response/redirect を返すと短絡する。 */
export type Middleware = (ctx: LoaderContext) => unknown | Promise<unknown>;

/** ページのメタ（`<title>` / `<head>` / `<html lang>`）。 */
export interface Meta {
  title?: string;
  head?: string;
  lang?: string;
}

/** 動的・非同期メタ。loader 結果や params から算出できる。 */
export type MetaFn<D = unknown> = (info: {
  data: D;
  params: RouteParams;
  url: URL;
}) => Meta | Promise<Meta>;

/** ページコンポーネントが受け取る props。 */
export interface RouteProps<D = unknown> {
  /** loader の戻り値。 */
  data: D;
  /** action の戻り値（あれば）。 */
  actionData?: unknown;
  params: RouteParams;
  url: URL;
}

/** loader 型から data を推論したページ props。`PageProps<typeof loader>` で使う。 */
export type PageProps<L extends Loader<any> = Loader<unknown>> = RouteProps<Awaited<ReturnType<L>>>;

/**
 * `routes/loading.tsx` の default export。クライアント遷移が 150ms を超えると、
 * 最寄りの loading 境界（ネスト可）が遷移先 HTML が届くまで表示される。島は不要。
 */
export type LoadingComponent = () => unknown;

/**
 * `routes/error.tsx` の default export が受け取る props。クライアント遷移が失敗したとき、
 * 最寄りの error 境界（ネスト可）が表示される。メッセージは `data-nowaki-error` を付けた
 * 要素へ、再試行は `data-nowaki-reset` を付けた要素へ、クライアントルーターが配線する。
 */
export interface ErrorPageProps {
  error: { message: string };
  reset: () => void;
}

/**
 * Jetstream（サーバーリアクティブ島）の宣言。島が `export const live` で持つと、
 * クライアントへコンポーネント JS を送らずに、状態はサーバーが保持し HTML パッチで更新する。
 */
export interface Live<S = any> {
  /** 初期状態（props を受け取れる）。 */
  state: (props?: any) => S;
  /** `data-live="名前"` のイベント → 新しい状態を返すハンドラ群。 */
  on: Record<string, (state: S, payload?: any) => S>;
}

/**
 * サーバー関数（`"use server"`）の実行中に、その呼び出しの LoaderContext を返す。
 * RPC 実行外では null。cookie/ヘッダの読み取り・認証に使う。
 */
export function getContext(): LoaderContext | null;
