# Nowaki ロードマップ

> 本書は方向性を示すもので、項目・順序・時期は予告なく変わります。設計の根拠は [DESIGN.md](./DESIGN.md) を参照。

## ビジョン

「Next.js の遅さへの構造的な答え」を、3つの柱で実現します。

1. Rustツールチェーン。変換・解決・バンドル・配信を oxc ベースの Rust が担い、起動とビルドを速く保つ。
2. デフォルトJSゼロ（Islands）。ページはサーバーで描画し、明示した「島」だけがクライアントで動く。
3. npm エコシステム互換。SSR は Node に委譲し、既存の資産をそのまま使える。

成功の指標（1.0時点の目標）: dev起動 < 300ms、HMR反映 < 100ms、典型ページのクライアントJS < 15KB(gzip)、実アプリでのドッグフーディング実績。

---

## 現在地（v0.1 alpha）

コアループは1つのサンプルアプリで通しで動作する状態。

- ✅ `nowaki dev`: axum devサーバー, oxcオンデマンド変換, `/@modules/`, Islands SSR(Nodeサイドカー), Remix風loader, live-reload HMR
- ✅ `nowaki build`: client（後順DFSグラフ走査 → content-hash付きESM + `manifest.json`）, server（routes/islands を SSR用ESMで `dist/server/` へ）
- ✅ `nowaki start`: 最低限の本番配信（`/_nowaki/` 静的配信 + prod SSR + manifest駆動のisland配線, HMRなし）
- ✅ `create-nowaki`: スキャフォールド（`npm create nowaki`）
- ✅ OSS整備: LICENSE(MIT, ©Voredge), README, CONTRIBUTING(DCO), CODE_OF_CONDUCT, SECURITY, CI, Issue/PRテンプレ
- ✅ GitHub: `nowaki-dev/nowaki`（private）

- ✅ 公開アーティファクト: crates.io（`nowaki-core`/`nowaki` 0.1.1）, npm（`@nowaki-dev/runtime` 0.1.0, `create-nowaki`/`create-nowaki-app` 0.1.0）, `nowaki.dev` 取得済み
- ✅ 公開導線を実証: `npm create nowaki`/`npx create-nowaki-app` → `pnpm install` → `cargo install nowaki`(0.1.1) → `nowaki dev` をドッグフーディングアプリ（`~/Desktop/Projects/nowaki-showcase`）で end-to-end 検証

**未達**: GitHub 公開リポジトリ化（現状private）, ランディング/ドキュメントサイト, ドッグフーディングの継続。

---

## リリースマイルストーン

各マイルストーンは「テーマ」「Exit基準（これが満たせたら次へ）」「主要成果物」で定義する。

### v0.1 「Gust」: Public Alpha ローンチ（進行中、ほぼ達成）
**テーマ**: 世に出す。最小限だが本物が触れる状態で公開する。
**Exit基準**: 誰でも `npm create nowaki` → `nowaki dev` が動き、リポジトリ・パッケージ・ドキュメントが公開されている。

- [x] crates.io 公開（`nowaki-core` → `nowaki` **0.1.1**）
- [x] npm 公開（`@nowaki-dev/runtime`, `create-nowaki`, `create-nowaki-app`）
- [x] `nowaki.dev` ドメイン取得
- [x] `npm create nowaki` の公開導線を検証（生成 → `npm install` でランタイム取得まで）
- [x] `cargo install nowaki` の導線確認（crates.io 経由ビルド → ショーケースアプリで実証）
- [ ] GitHub repo を public 化、`nowaki-dev/maintainers` チーム、ブランチ保護
- [ ] `nowaki.dev` 最小ランディング + Getting Started（5分で動くまで）
- [ ] `nowaki --version` 対応（小）, 壊れた crates 0.1.0 の yank（任意）

### v0.2 「Breeze」: DX & 正しさ
**テーマ**: 毎日使える開発体験。
**Exit基準**: 小規模な実アプリを Nowaki でドッグフーディングできる。

- [ ] **エラーオーバーレイ**（変換/SSR/ランタイムエラーをブラウザに表示, ソースマップ付き）
- [ ] **prefresh による部分HMR**（島のステートを保持したホットスワップ。現状の full reload を置換）
- [ ] CSS の取り扱い（`.css` import, scoped styles の基礎）
- [ ] 環境変数（`.env`, ビルド時/実行時の区別, クライアント露出の安全策）
- [ ] 診断の質（解決失敗・型エラーの分かりやすい表示, コードフレーム）
- [ ] build 仕上げ: `modulepreload` マニフェスト, island の無いページでの runtime script 省略

### v0.3 「Squall」: ルーティング & データ ← 実装完了
**テーマ**: 実用フレームワークの機能面。
**Exit基準**: 基本的な Next/Remix アプリと機能比較できる。

- [x] ネストレイアウト（`_layout.tsx`）と共有UI
- [x] ミドルウェア（`_middleware.ts`、認証・リダイレクト・ヘッダ操作、ネスト可）
- [x] データ更新（`action` / form submission, Remix風 mutation）。後で server-reactive で「押せる」形（v0.6 Jetstream の前提）
- [x] API routes 拡充（メソッド分岐 GET/POST/…, 型付きハンドラ, `Response`/ストリーミング, 405）
- [x] クライアントルーター（島間SPA遷移, prefetch, スクロール復元, popstate）。島ランタイムに同梱しJSゼロページは素のフルナビ。DOM 差し替えは v0.6 Jetstream と共有
- [x] 404/500・エラーバウンダリのルート規約（`_404.tsx` / `_500.tsx`）
- [x] リダイレクト/ヘッダ/Cookie ヘルパ, `LoaderContext` の整備

> dev/prod 共有ハンドラ(`handler.mjs`)に集約。dev・prod・prerender とも検証済み、SPA 遷移はヘッドレス Chrome で実機確認。

### v0.4 「Monsoon」: バンドラーの深化 ← 完了
**テーマ**: 本番品質の出力と高速なビルド。これが Rust バンドラーの本丸。
**Exit基準**: 中規模アプリで Next 同等以上のビルド速度と出力品質。

- [x] **真のチャンクバンドリング**: island単位エントリ + 共有チャンク分割（node_modules/preact は dedup）+ **スコープホイスティング**（その island だけが使うアプリモジュールを1スコープへ連結。トップレベルをグローバル一意名にリネーム、内部 import を直接参照に、循環も1スコープ内で解決）+ 全推移依存の modulepreload で瀑布回避。連結未対応の構文は従来 emit にフォールバック
- [x] ツリーシェイキング / dead code elimination（oxc_minifier の compress + mangle）
- [x] **永続ディスクキャッシュ**（`node_modules/.cache/nowaki`、再起動をまたぐ content-addressed）
- [x] end-to-end ソースマップ（dev: インライン / prod client: 外部 .map / SSR: インライン + `--enable-source-maps`）
- [x] CSS modules / scoped styles（`*.module.css`、client注入 + SSRマップ一致、CSS パーサ非依存）
- [x] アセット import とハッシュ（画像・フォント・メディア、client/SSR一貫）
- [x] 循環依存対応（pre-rewrite ハッシュ フォールバック）, `rayon` でのサーバービルド並列化
- [x] 島の安定シリアライズ（props をキー順固定で決定的に → v0.6 Jetstream の前提）

### v0.5 「Typhoon」: エコシステム & デプロイ ← 完了（0.5.0）
**テーマ**: どこにでも出せる、拡張できる。
**Exit基準**: 主要なデプロイ先に出せ、サードパーティ拡張が書ける。**→ 達成**（5アダプタ + プラグイン/TSRX）。

> **npm/crates 0.5.0** でデプロイアダプタ5種・ストリーミング SSR・プラグイン変換フック・TSRX・
> **Rust prod ホットパス**を公開。プラグインの仮想モジュール（resolveId/load）は解決ホットパスを
> 触る invasive 変更のため、安全のため v0.6 のプラグイン成熟へ送る（transform フックと新規拡張子は出荷済み）。

- [x] **TSRX ブリッジ**（`.tsrx` → `@tsrx/preact` で標準 JSX へコンパイル → oxc の JSX→preact パイプライン合流）。プラグインホストに `@tsrx/preact` を載せ（アプリ依存・任意）、`.tsrx` を resolver 拡張子・`is_transformable`・island 検出・dev/prod 両方に統合。例: `examples/hello/islands/TsrxCounter.tsrx`（statement-container 構文 + `preact/hooks`）が dev・本番で SSR＋ハイドレート（5→6）検証済。scoped CSS 抽出は後続
- [x] デプロイアダプタ（`nowaki build --adapter <node|static|bun|deno|cloudflare>`）。**Node**=自己完結エントリ `dist/server/index.mjs`（`node` だけで配信、nowaki バイナリ不要）/ **static**=prerender 出力 / **Bun・Deno**=node:http 互換の同一エントリで移植可 / **Cloudflare Workers（Edge）**=全サーバーモジュールを静的バンドルした fetch ハンドラ worker ＋ wrangler 設定を生成（node:http も実行時 import も不使用、静的アセットは Assets binding）。SSR・API・ストリーミング・404・島ハイドレートを `wrangler dev`（workerd）で検証済
- [x] プリレンダリング（SSG, v0.1済）と **ストリーミング SSR**（ルートが `export const streaming = true` でオプトイン、`renderToReadableStream` でシェル先行送出。島ハイドレートまで検証済）
- [x] プラグイン API。`nowaki.config.{mjs,js}` の `plugins[].transform(code, id)` 変換フックを **dev・build 両方**で適用（Node プラグインホスト経由。nowaki-core は `PluginBridge` trait で疎結合、設定が無ければオーバーヘッドゼロ）。新規拡張子もサポート（TSRX が実例）。**仮想モジュール（resolveId/load）は v0.6 のプラグイン成熟へ**（解決ホットパスを触るため安全側に倒す）
- [x] サイドカーの抽象化（SSR 中核を `@nowaki-dev/runtime` の `server/app.mjs`＝node:http 互換に集約。`nowaki start`(prod-sidecar)・node/static/bun/deno/cloudflare 各アダプタ・dev が共有。実行系は Node/Bun/Deno をアダプタで選択可）
- [x] **Rust を prod ホットパスへ**。`nowaki start` が **Rust(axum) フロント**＝静的配信(dist/client, immutable)・HTML 組み立て(island 配線・modulepreload を Rust の `start.rs::assemble` で生成)・HTTP エッジを担い、Node `prod-sidecar.mjs` は「コンポーネント描画」だけ（ページは body+メタを JSON で返す。API/redirect/stream は素通し）。島ハイドレートまで検証済。v0.6 Jetstream（Rust が HTML パッチを押し出す）の足場

### v0.6 「Jetstream」: サーバーリアクティブ島 ＝ **Jetstream islands** ★flagship ← 実装完了
**テーマ**: Nowaki だけの差別化。サーバーデータ駆動の更新を、クライアントJSを増やさず Rust サーバーが HTML パッチで押し出す。
**Exit基準**: 「コンテンツ主体だが動的」なアプリで、サーバーデータ更新が JS 追加ゼロの島として動き、楽観UIの島と共存し、静的デプロイも壊さない。**→ 達成（dev・本番でe2e検証）**。

> **実装**: 島が `export const live = { state, on }` を持てば「ライブ島」。コンポーネント JS はクライアントへ送らず（build がチャンクを出さず、`<nowaki-live>` で SSR）、状態は Rust が `/__nowaki/live` WebSocket 接続ごとに保持。クリック等の `data-live` イベントを Rust が Node サイドカー（純粋な `handler(state)→state` ＋ `render(state)→html`）へ橋渡しし、新 HTML を patch として push。クライアント `live.js`（~2KB, WS＋DOM morph）が当てる。`crates/nowaki/src/live.rs`（WS セッション）＋ `server/live.mjs`（再評価）＋ `client/live.js`。

- [x] **SR-0 スパイク / SR-1 MVP**: `/__nowaki/live` WS + DOM morph ランタイム + オーサリングAPI（`export const live` / `on`）。イベント→サーバー再評価→patch push を dev・本番（`nowaki start` の Rust front）で通し、`examples/hello`(LiveCounter) でカウンタが 0→1→2→reset を WS 往復で更新（headless 検証）
- [x] **SR-2 実用**: 再接続（指数バックオフ＋再 join で状態回復）、**クライアント島（楽観UI）との共存**（同一ページで `<nowaki-live>` と `<nowaki-island>` が両立・検証済）、ターゲット限定パッチ（nid 単位）、複数クライアント（WS 接続ごとに独立した状態）。接続スケールの本格チューニングは Beta で継続
- [x] **SR-3 両建て**: 静的島モード（prerender/static・node・edge は初期 SSR を配信し、WS 無しでも壊れず劣化のみ）↔ 接続モード（`nowaki start` の Rust front が WS を保持）。build は `manifest.liveIslands`/`liveRuntime` で振り分け、ライブ島の **クライアント JS はゼロ**

### v0.7 「Beta」: 安定化の土台 ← 完了
**テーマ**: 壊れない・速い・信頼できる、を測れる形にする。

- [x] **自動テストスイート**: `cargo test` のユニット（alias/拡張子判定/CSS スコープ化の決定性）＋ 統合（`transform_file` の型剥がし・JSX→preact・react alias・defines）＋ CLI 統合（バイナリで examples/hello をビルドし manifest・スコープホイスティング・ライブ島ゼロJS を検証）。CI の Rust ジョブで実行。e2e/ハイドレーションは既存 e2e ジョブが担当
- [x] **正直なベンチマーク**: 再現可能な `benchmarks/bench.mjs`（dev ready cold/warm・build・送信JS gzip・TTFB）＋ [BENCHMARKS.md](./BENCHMARKS.md) に実測値と方法論。site/ で dev ready ~70〜90ms を裏取り（ランディングの主張と整合）。Next/Astro との head-to-head は今後
- [x] **セキュリティ**: [SECURITY.md](./SECURITY.md) に信頼境界（`/@fs` は dev 限定・各 host は localhost・basename 配信・secrets はサーバー側・Jetstream 状態）を明文化。CI に `cargo audit` ＋ `pnpm audit` の継続監査ジョブ
- [x] **semver 規律 + 変更履歴**: [CHANGELOG.md](./CHANGELOG.md)（0.1.0→0.6.0）＋ docs/RELEASING.md に SemVer/破壊的変更方針

### v0.8〜v0.9 「Beta」: 拡充・実用化 ← ほぼ完了
**テーマ**: 機能の角を取り、採用事例を作る。
**Exit基準**: API が概ね固定され、本番採用の事例が出る。

- [x] **サーバー関数（実験的）**: `"use server"` RPC（RSC的なサーバー↔クライアント境界）。
  ディレクティブを持つモジュールの export はサーバーにだけ残り、クライアントは fetch する極小
  プロキシのみ。id ベースの allowlist で dispatch（任意 export は呼べない）、`getContext()` で
  cookie/ヘッダにアクセス。dev・`nowaki start`・edge で検証済
- [x] パフォーマンスベンチを Next/Astro と head-to-head（`benchmarks/head-to-head.mjs`、同一カウンタ
  アプリ）＋ 送信 JS サイズの回帰検出を CI に（`benchmarks/check-regression.mjs` + baseline）
- [x] テストスイート拡充（ルーターの snapshot 単体テスト、Jetstream の複数接続 WS e2e
  `scripts/livetest.mjs`、server-fn・仮想モジュール・presence の e2e を CI へ）
- [x] Jetstream の **presence・接続スケール**（presence ブロードキャスト・ハートビート・接続上限）、
  **プラグイン仮想モジュール**（`resolveId`/`load`）／ prefresh HMR は follow-up（島ホットスワップは
  既存。状態保持は @prefresh/babel 相当の注入が必要なため見送り）
- [x] ドキュメントサイト本格版（`/docs`：Overview・Quickstart・Routing・Server functions・
  Jetstream・Plugins・Deploy・Next 移行ガイド。Nowaki 製・クライアント JS ゼロ）

### v1.0 「Nowaki」: 安定版
**テーマ**: 約束できる土台。
**Exit基準**: 公開API安定保証, 完全なドキュメント, ガバナンス確立。

- [ ] 公開 API 安定保証 + 非互換ポリシー
- [ ] 完全なドキュメントと移行ガイド
- [ ] ガバナンス（メンテナ体制, RFCプロセス, リリース手順）
- [ ] LTS / サポートポリシー

---

## 横断ワークストリーム

マイルストーンを縦糸とすると、以下は横糸。常時進行する。

| トラック | 内容 |
|---|---|
| **DX** | HMR, エラーオーバーレイ, CLI体験, 型補完(`.d.ts`生成), テンプレ拡充 |
| **バンドラー/性能** | グラフ, チャンク, キャッシュ, ソースマップ, ベンチ, 並列化 |
| **フレームワーク** | ルーティング, データ(loader/action), レンダリング(SSR/SSG/stream), ミドルウェア |
| **サーバーリアクティブ** | 持続チャンネル(WS/SSE), morph ランタイム, パッチ生成(Rust), 接続管理, 静的↔接続の両建て (v0.6 Jetstream) |
| **エコシステム** | TSRX, アダプタ, プラグインAPI, サイドカー選択 |
| **品質** | テスト, ベンチ回帰検出, `cargo audit`/`npm audit` のCI化, セキュリティレビュー |
| **ドキュメント/コミュニティ** | ドキュメントサイト, レシピ, RFC, Discord/Discussions, コントリビュータ導線 |
| **リリース/レジストリ** | crates.io/npm publish 自動化, リリースCI, バージョニング, 名前/商標確保 |

---

## 公開ローンチ・チェックリスト（v0.1 の関門, ユーザー作業）

> 出力不安定化の可能性があるため、publish/購入は手元の `! コマンド` 実行が安全。順序は用意可能。

1. ✅ **名前確保**: crates.io `nowaki`/`nowaki-core`, npm `@nowaki-dev/runtime`/`create-nowaki`, `nowaki.dev`
2. ✅ **publish**: crates.io（`nowaki-core`→`nowaki`）, npm（`@nowaki-dev/runtime`, `create-nowaki`）。全て公開済み・API裏取り済み
3. ⬜ **GitHub**: public 化, `nowaki-dev/maintainers`, ブランチ保護(PR必須+CI必須), Discussions 有効化
4. ⬜ **ドキュメント**: Getting Started, `nowaki.dev` ランディング
5. ⬜ **告知**: alpha・本番非推奨を明記した上で公開

---

## リスク・未解決の論点

- **TSRX が alpha**: API変動リスク。`TransformBridge` で隔離済みだが、依存タイミングは要監視
- **Nodeサイドカー依存**: 起動コスト/運用。将来 Bun/Deno/Edge で軽量化したい
- **Islands の粒度**: 手動の `islands/` 配置が最適か、自動判定や `"use client"` 的な指定も検討
- **prod の Rust の役割**: 現状 prod は純Node。Rust製の高速静的配信/エッジ実行をどこまで持つか（v0.5 で決着 → v0.6 Jetstream の足場）
- **Jetstream のステートフル接続**: サーバーリアクティブ島はステートフル接続前提。スケール/再接続コストと、「静的に置ける手軽さ」との両立（SR-3）が設計の肝。先に SR-0 スパイクで体感を確かめてから旗艦化する
- **キャッシュ無効化の正確性**: content-hash の伝播（特に循環時）と dev の SSR 再評価
- **名前/商標**: Nowaki の商標確保、`nowaki-dev` Org の所有体制（Voredge）
