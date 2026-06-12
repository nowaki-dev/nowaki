# Nowaki (野分) — 設計書

> Rust製ツールチェーンを核とする、爆速フルスタックWebフレームワーク

## 0. コンテキスト — なぜ作るのか

Next.js の体感的な遅さには構造的な原因がある:

| Next.js の問題 | 原因 | Nowaki の回答 |
|---|---|---|
| `next dev` の起動が遅い | JSベースの初期化、巨大な内部グラフ構築 | Rustバイナリが即起動、オンデマンド変換 |
| HMR が重くなる | グラフ再計算とJSプラグインパイプライン | oxcによるms級の単一ファイル再変換 + 無効化のみ |
| ページのJSが肥大化 | 全コンポーネントをハイドレート | **Islands**: 明示した「島」以外はJSゼロ |
| ビルドが遅い | webpack互換層・JS最適化パス | oxc minifier、rayon並列、コンテンツハッシュキャッシュ |

**目標性能 (MVP基準)**: dev起動 < 300ms / HMR反映 < 100ms / カウンター1個のページのクライアントJS < 15KB (gzip)。

## 1. 確定した設計判断

1. **UIランタイム**: **Preact** (3KB, ESM配布, React互換hooks)。ESM配布なのでdev時のCJS prebundle工程が不要になり、バンドラーが単純化する。
2. **オーサリング構文**: `.tsx` (oxcネイティブ・最速パス) + **TSRX** (`.tsrx`, Phase 2)。TSRXはRipple作者によるステートメントベースのJSX後継構文で、コンパイラ(`@tsrx/core`)はJS実装のため、Nodeコンパイルブリッジ経由でPreactターゲットにコンパイルし、oxcパイプラインに合流させる。現状alphaのためMVPには含めず、差し込み口(TransformBridge)のみ確保。
3. **レンダリングモデル**: **Islands Architecture** (Astro/Fresh方式)。ページはサーバーでHTML化し、`islands/` ディレクトリ配下のコンポーネントだけがクライアントでハイドレートされる。
4. **バンドラー土台**: **oxcクレート群** (oxc_parser / oxc_transformer / oxc_codegen / oxc_minifier / oxc_resolver)。モジュールグラフ、HMR、キャッシュ、チャンク戦略は自作 — ここが「バンドラー開発」の本体。TurbopackがSWC上に構築されたのと同じ構図。
5. **SSR実行**: **Nodeサイドカー**。Rustがアセット配信/変換/HMRを担い、コンポーネント描画はRustが管理するNodeワーカーへ委譲。npmエコシステムがそのまま動く。

## 2. 全体アーキテクチャ

```
┌─────────────────────────── nowaki dev (Rustバイナリ) ───────────────────────────┐
│                                                                               │
│  axum HTTP server (:3000)                                                     │
│  ├─ GET /__nowaki/hmr ............ WebSocket (HMRクライアント接続)                │
│  ├─ GET /__nowaki/ssr-module ..... SSR用変換モジュール配信 (Nodeローダーフック向け) │
│  ├─ GET /@modules/* ............ node_modules ESM配信 (resolver + 変換)        │
│  ├─ GET /*.tsx, /*.ts .......... プロジェクトファイルのオンデマンド変換配信       │
│  └─ GET /* (それ以外) .......... Nodeサイドカーへリバースプロキシ (SSR HTML)     │
│                                                                               │
│  nowaki-core (lib)                                                              │
│  ├─ Transformer: oxc parse → TS strip + JSX(automatic, preact) → codegen      │
│  ├─ Resolver: oxc_resolver (bare import → 実ファイル → /@modules/ URL)         │
│  ├─ ModuleCache: DashMap<(path, mode), (content_hash, output)>                │
│  └─ Watcher: notify → 無効化 + HMRブロードキャスト + SSRバージョン更新            │
│                                                                               │
│  Sidecar Manager: Node子プロセスの起動/監視/再起動                              │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    │ HTTP (127.0.0.1:エフェメラル)
┌───────────────────────────────────▼───────────────────────────────────────────┐
│  Nodeサイドカー (packages/nowaki-runtime/server)                                  │
│  ├─ ルートスキャン: routes/ → URLパターン (index/[slug]/api)                    │
│  ├─ loader実行 → preact-render-to-string でページ描画                           │
│  ├─ Islands検出: options.vnodeフックで島コンポーネントをマーカーで包む            │
│  └─ moduleローダーフック: .tsx/.ts は /__nowaki/ssr-module から変換済JSを取得      │
└────────────────────────────────────────────────────────────────────────────────┘

ブラウザ: SSR HTML + <script type="module" src="/@nowaki/client.js">
          → マーカー走査 → 島モジュールをdynamic import → hydrate(props)
```

### リポジトリ構成

```
nowaki/
├── Cargo.toml                  # workspace
├── crates/
│   ├── nowaki-core/              # バンドラー本体 (transform / resolve / graph / cache)
│   └── nowaki/                   # CLIバイナリ (dev / build / start) + devサーバー + sidecar管理
├── packages/
│   └── nowaki-runtime/           # npm: @nowaki/runtime
│       ├── client/             #   islandsハイドレーション + HMRクライアント
│       └── server/             #   SSRサイドカー + Nodeローダーフック
├── examples/
│   └── hello/                  #   サンプルアプリ (検証用)
│       ├── routes/index.tsx
│       └── islands/Counter.tsx
└── DESIGN.md
```

## 3. Rustバンドラー (nowaki-core) の設計

### 3.1 変換パイプライン

```
ソース読込 → xxhashでcontent_hash → キャッシュHIT? → 返却
                                   ↓ MISS
oxc_parser (TSX) → oxc_transformer { TS型剥がし, JSX automatic (importSource: "preact") }
                 → import書き換え (browserモードのみ)
                 → oxc_codegen (+ inline sourcemap)
                 → キャッシュ格納 → 返却
```

- **2モード**: `mode=browser` はbare import (`preact` 等) を `/@modules/...` URLへ書き換える。`mode=ssr` はimportを書き換えない（Node解決に任せる）。キャッシュキーは `(絶対パス, mode)`、値に `content_hash` を持ち変更検知。
- **bare import解決**: oxc_resolver で実ファイルに解決し、`/@modules/<pkg>/<entryからの相対>` にマップ。node_modules内のESMファイル自体も同パイプラインを通す（preact/hooks が内部でbare import `preact` を持つため再帰的に書き換えが必要）。
- **並列性**: 状態は `DashMap`。HTTPハンドラごとに `tokio::task::spawn_blocking` でoxc変換（CPUバウンド）を実行。

### 3.2 HMR (MVP → 将来)

- **プロトコル**: WebSocket、JSONメッセージ `{type: "reload"}` / `{type: "update", path, version}` / `{type: "error", message}`。
- **MVP**: notifyでの変更検知 → 該当キャッシュ無効化 + グローバル `ssr_version` インクリメント → `reload` をブロードキャスト（フルリロード。SSRが速いので体感は十分速い）。変換エラーはオーバーレイ表示用に `error` を送る。
- **Phase 3**: モジュールグラフの逆依存辺を保持し、島モジュール単位の `update` + prefresh (Preact Fast Refresh) によるステート保持ホットスワップ。

### 3.3 本番ビルド (`nowaki build`) — 段階的戦略

- **Phase 1 (MVP+) — ✅実装済み (`crates/nowaki-core/src/build.rs`)**: エントリ（islandsランタイム + 各island）から後順DFSでグラフを辿り、各モジュールを変換 + codegen minify + import指定子をコンテンツハッシュ付ファイル名に書き換えて `dist/client/` へ出力（unbundled ESM emit）。共有依存（preact等）はパス単位でdedup。`manifest.json`（runtime + island名→ハッシュ名）を生成。後順DFSなので依存のハッシュ確定後に親を確定し、コンテンツハッシュが最終内容と一致する。**既知の残り**: (1) island の動的ロードはmanifest駆動のHTML/SSR配線が必要（`nowaki start` + prod SSR）、(2) 循環依存は現状エラー、(3) `modulepreload` マニフェスト出力。
- **Phase 3**: スコープホイスティングによる真のチャンクバンドリング（island単位エントリチャンク + 共有チャンク）。rayonでチャンク並列コード生成。

## 4. フレームワーク規約 (ユーザーから見た姿)

### ルーティング (ファイルベース)

| ファイル | URL |
|---|---|
| `routes/index.tsx` | `/` |
| `routes/about.tsx` | `/about` |
| `routes/blog/[slug].tsx` | `/blog/:slug` |
| `routes/api/hello.ts` | `/api/hello` (handler関数をexport) |

### データ取得 (Remix風loader)

```tsx
// routes/index.tsx — サーバーでのみ実行される
export const loader = async (ctx: LoaderContext) => {
  return { message: "こんにちは", time: Date.now() };
};

export default function Home({ data }: PageProps<typeof loader>) {
  return <main>
    <h1>{data.message}</h1>
    <Counter start={5} />   {/* islands/Counter.tsx → これだけハイドレート */}
  </main>;
}
```

### Islands

- `islands/` 配下のコンポーネントだけがクライアントJSを持つ。ページ本体・loaderのコードはブラウザに一切送られない。
- 検出はランタイム方式: サイドカーが `islands/` をスキャンして「コンポーネント実体 → 島名」のレジストリを作り、Preactの `options.vnode` フックで描画中の島を `<nowaki-island data-island data-props>` でラップ。Rust側のAST加工が不要でMVPが単純になる。
- propsはJSONシリアライズ可能であること（境界の規約として明示）。

## 5. SSRサイドカーの設計

- Rustが `node .../server/sidecar.mjs --port 0` を起動し、stdoutの `NOWAKI_SIDECAR_READY <port>` で接続先を得る。クラッシュ時は自動再起動。
- **TSXのSSR実行**: Node単体はJSXを解釈できないため、`module.registerHooks` のloadフックで `.tsx/.ts` を Rust devサーバーの `/__nowaki/ssr-module?path=...&v=<ssr_version>` から変換済ESMとして取得する（vite-node方式 — 変換器をRust一本に統一するのが狙い）。
- **HMR時の再評価**: ESMキャッシュは無効化できないため、ルートモジュールを `?v=<ssr_version>` 付きでdynamic importし、resolveフックが相対importにも同じversionを伝播させる。devでの旧バージョンのメモリ残留は許容（Viteと同様のトレードオフ）。
- 本番では loader hooksは使わず、ビルド済み `dist/server/` を直接実行する。

## 6. TSRX統合 (Phase 2)

- `.tsrx` ファイルはRust側で検知し、Nodeコンパイルワーカー（`@tsrx/core` でparse → Preactターゲットへcodegen）に委譲。出力TS/JSXをoxcパイプラインに合流させる。content_hashキャッシュにより編集1回につきJSコンパイル1回で済む。
- alphaでAPIが変動するため、`TransformBridge` trait（`fn compile(path, source) -> Result<String>`）の背後に隔離し、コアから疎結合に保つ。

## 7. ロードマップ

- **Phase 1 (MVP)**: 本書 §2–§5 の dev 体験一式 — `nowaki dev`, oxc変換, /@modules/, Islands SSR, loader, live-reload HMR, サンプルアプリ
- **Phase 1.5**: ✅`nowaki build`（クライアントグラフのhashed ESM emit + manifest）と ✅`create-nowaki` scaffolding は実装済み。残り: `nowaki start`（prod SSR配線）, エラーオーバーレイ
- **Phase 2**: TSRXブリッジ, API routes拡充, ミドルウェア, 環境変数
- **Phase 3**: チャンクバンドリング(スコープホイスティング), prefresh部分HMR, 永続ディスクキャッシュ, クライアントルーター(島間SPA遷移)
- **Phase 4**: Bun/Denoサイドカー対応, Edgeランタイムビルド, RSC的サーバー関数 (`"use server"` RPC)

## 8. 主要依存

- **Rust**: oxc (umbrella, features: transformer/codegen/minifier), oxc_resolver, axum, tokio, tower-http, notify, dashmap, clap, xxhash-rust, serde/serde_json
- **npm**: preact, preact-render-to-string (devDependenciesは無し — ランタイムを薄く保つ)
