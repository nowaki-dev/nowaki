# Nowaki ロードマップ

> 方向性を示すものです。項目・順序・時期は予告なく変わります。設計の根拠は
> [DESIGN.md](./DESIGN.md)、各リリースの詳細は [CHANGELOG.md](./CHANGELOG.md) を参照。

## ビジョン

「Next.js の遅さへの構造的な答え」を、3つの柱で実現します。

1. **Rust ツールチェーン** — 変換・解決・バンドル・配信を oxc ベースの Rust が担い、起動とビルドを速く保つ。
2. **デフォルト JS ゼロ（Islands）** — ページはサーバーで描画し、明示した「島」だけがクライアントで動く。
3. **npm エコシステム互換** — SSR は Node に委譲し、既存の資産をそのまま使える。

**成功の指標（1.0 時点の目標）**: dev 起動 < 300ms、HMR 反映 < 100ms、典型ページのクライアント JS < 15KB(gzip)、実アプリでの採用実績。

## 現在地

**alpha（0.9.x、crates.io / npm に公開済み）**。`npm create nowaki` で雛形を作り、`nowaki dev / build / start / prerender` が通しで動きます。ルーティング・loader/action・ミドルウェア・API・Islands・Jetstream（サーバーリアクティブ島）・サーバー関数・5種のデプロイアダプタ・プラグイン/仮想モジュールが揃っています。本番採用はまだ推奨しません（API は安定化の途中）。

## マイルストーン

各マイルストーンは「テーマ」と「Exit 基準」で定義します。完了済みの実装詳細は CHANGELOG を参照。

### v0.1 「Gust」: Public alpha ✅
世に出す。誰でも `npm create nowaki` → `nowaki dev` が動き、パッケージとドキュメントが公開されている。

### v0.2 「Breeze」: DX & 正しさ ✅
毎日使える開発体験。エラーオーバーレイ、CSS（`.css` import・scoped styles）、環境変数（`.env`、`PUBLIC_*` の露出制御）、コードフレーム診断、`modulepreload` マニフェスト。

### v0.3 「Squall」: ルーティング & データ ✅
ネストレイアウト（`_layout.tsx`）、ミドルウェア（`_middleware.ts`）、`action`（フォーム送信）、メソッド別 API ルート、島間 SPA ルーター、404/500 規約、`LoaderContext`。

### v0.4 「Monsoon」: バンドラーの深化 ✅
真のチャンクバンドリング + スコープホイスティング、ツリーシェイキング、永続ディスクキャッシュ、end-to-end ソースマップ、CSS Modules、アセット import とハッシュ、循環依存対応。

### v0.5 「Typhoon」: エコシステム & デプロイ ✅
デプロイアダプタ5種（node / static / bun / deno / cloudflare edge）、ストリーミング SSR、プラグイン変換フック、TSRX ブリッジ、`nowaki start` の Rust 本番ホットパス。

### v0.6 「Jetstream」: サーバーリアクティブ島 ★flagship ✅
**Jetstream islands** — 島が `export const live = { state, on }` を持つと、コンポーネント JS をクライアントに送らずに動く。状態はサーバーが WebSocket 接続ごとに保持し、HTML パッチを push。クライアント島（楽観 UI）と共存し、静的デプロイでは初期 SSR に劣化する。

### v0.7 「Beta」: 安定化の土台 ✅
`cargo test` スイート、再現可能なベンチマーク（[BENCHMARKS.md](./BENCHMARKS.md)）、信頼境界の明文化（[SECURITY.md](./SECURITY.md)）と CI の依存監査、SemVer 規律と [CHANGELOG.md](./CHANGELOG.md)。

### v0.8〜v0.9 「Beta」: 拡充・実用化 ✅
**サーバー関数（`"use server"` RPC）**、Next/Astro との head-to-head ベンチ + CI 回帰検出、テスト拡充（ルーター snapshot・Jetstream 負荷）、Jetstream の presence・接続スケール、**プラグイン仮想モジュール（resolveId / load）**、ドキュメントサイト（`/docs`）。

> 状態保持（prefresh）HMR は follow-up（島ホットスワップは既存）。TSRX 島の scoped CSS も継続。

### v1.0 「Nowaki」: 安定版
**Exit 基準**: 公開 API の安定保証、完全なドキュメント、ガバナンス確立。

- [ ] 公開 API の安定保証 + 非互換ポリシー
- [ ] 完全なドキュメントと移行ガイド
- [ ] ガバナンス（メンテナ体制、RFC プロセス、リリース手順）
- [ ] LTS / サポートポリシー

## 横断的に続くこと

マイルストーンを縦糸とすると、以下は横糸として常時進みます。

- **DX** — HMR、エラー表示、CLI 体験、型補完（`.d.ts`）、テンプレート拡充
- **性能** — バンドルグラフ、キャッシュ、ソースマップ、ベンチ回帰検出
- **エコシステム** — アダプタ、プラグイン API、TSRX
- **品質** — テスト、`cargo audit` / `pnpm audit`、セキュリティレビュー
- **コミュニティ** — ドキュメント、レシピ、RFC、コントリビュータ導線
