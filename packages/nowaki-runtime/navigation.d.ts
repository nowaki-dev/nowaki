// 型安全なナビゲーションの型（@nowaki-dev/runtime/navigation）。
//
// アプリの routes/ から `nowaki typegen`（dev/build が自動実行）が .nowaki/types.d.ts を生成し、
// `declare module "@nowaki-dev/runtime/navigation" { interface NowakiRoutes { ... } }` で
// 実際のルートを登録する。生成前は RoutePath が string にフォールバックする（緩い）。

import type { VNode } from "preact";

/** 生成された型がパス→パラメータ型を登録する。例: { "/blog/[slug]": { slug: string } } */
export interface NowakiRoutes {}

type Keys = keyof NowakiRoutes & string;

/** 既知のルートパスの合併（未生成なら string）。 */
export type RoutePath = [Keys] extends [never] ? string : Keys;

type ParamsOf<P extends string> = P extends keyof NowakiRoutes
  ? NowakiRoutes[P]
  : Record<string, string | string[]>;

/** パラメータの無い静的ルートだけの合併（Link の href に直接使える）。 */
type StaticRoutePath = [Keys] extends [never]
  ? string
  : { [P in Keys]: {} extends ParamsOf<P> ? P : never }[Keys];

/** route() が返す、検証済み href のブランド型。 */
export type Href = string & { readonly __nowaki: "href" };

/**
 * 動的ルートの href を型安全に組む。
 *   route("/about")                       // パラメータ不要
 *   route("/blog/[slug]", { slug: "hi" }) // 必須パラメータ
 *   route("/files/[...path]", { path: ["a", "b"] }) // catch-all は配列
 * 不明なルート・パラメータ不足・キー違いはコンパイルエラー。
 */
export function route<P extends RoutePath>(
  pattern: P,
  ...args: {} extends ParamsOf<P> ? [] : [params: ParamsOf<P>]
): Href;

export interface LinkProps {
  /** 静的ルート（型チェックあり）、または route() で組んだ href。 */
  href: StaticRoutePath | Href;
  class?: string;
  className?: string;
  target?: string;
  rel?: string;
  /** SPA 遷移を無効にして通常の遷移にする。 */
  "data-no-router"?: boolean;
  children?: unknown;
  [key: string]: unknown;
}

/** 型付きの <a>。クライアントルーターが SPA 遷移として扱う。 */
export function Link(props: LinkProps): VNode;
