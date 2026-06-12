# Nowaki ロードマップ 🌀

> 本書は方向性を示すもので、項目・順序・時期は予告なく変わります。設計の根拠は [DESIGN.md](./DESIGN.md) を参照。

## ビジョン

**「Next.js の遅さへの構造的な答え」** を、3つの原則で実現する:

1. **Rustツールチェーン** — 変換・解決・バンドル・配信は oxc ベースの Rust が担い、起動とビルドを高速に保つ
2. **デフォルトJSゼロ（Islands）** — ページはサーバーで描画し、明示した「島」だけがクライアントで動く
3. **npmエコシステム互換** — SSR は Node に委譲し、既存の資産をそのまま使える

成功の指標（1.0時点の目標）: dev起動 < 300ms / HMR反映 < 100ms / 典型ページのクライアントJS < 15KB(gzip) / 実アプリでのドッグフーディング実績。

---

## 現在地（v0.1 alpha）

コアループは1つのサンプルアプリで通しで動作する状態。

- ✅ `nowaki dev` — axum devサーバー, oxcオンデマンド変換, `/@modules/`, Islands SSR(Nodeサイドカー), Remix風loader, live-reload HMR
- ✅ `nowaki build` — client（後順DFSグラフ走査 → content-hash付きESM + `manifest.json`）, server（routes/islands を SSR用ESMで `dist/server/` へ）
- ✅ `nowaki start` — 最低限の本番配信（`/_nowaki/` 静的配信 + prod SSR + manifest駆動のisland配線, HMRなし）
- ✅ `create-nowaki` — スキャフォールド（`npm create nowaki`）
- ✅ OSS整備 — LICENSE(MIT, ©Voredge), README, CONTRIBUTING(DCO), CODE_OF_CONDUCT, SECURITY, CI, Issue/PRテンプレ
- ✅ GitHub — `nowaki-dev/nowaki`（private）

**未達**: crates.io / npm / `nowaki.dev` の名前確保、公開リポジトリ化、ドキュメントサイト、実アプリ検証。

---

## リリースマイルストーン

各マイルストーンは「テーマ」「Exit基準（これが満たせたら次へ）」「主要成果物」で定義する。

### v0.1 「Gust」— Public Alpha ローンチ ← 次の関門
**テーマ**: 世に出す。最小限だが本物が触れる状態で公開する。
**Exit基準**: 誰でも `npm create nowaki` → `nowaki dev` が動き、リポジトリ・パッケージ・ドキュメントが公開されている。

- [ ] crates.io 公開（`nowaki-core` → `nowaki`）
- [ ] npm 公開（org `@nowaki`, `@nowaki/runtime`, `create-nowaki`）
- [ ] `nowaki.dev` 取得（Cloudflare）+ 最小ランディング/ドキュメント
- [ ] GitHub repo を public 化、`nowaki-dev/maintainers` チーム、ブランチ保護
- [ ] `cargo install nowaki` / `npx create-nowaki` の導線確認
- [ ] Getting Started ドキュメント（5分で動くまで）

### v0.2 「Breeze」— DX & 正しさ
**テーマ**: 毎日使える開発体験。
**Exit基準**: 小規模な実アプリを Nowaki でドッグフーディングできる。

- [ ] **エラーオーバーレイ**（変換/SSR/ランタイムエラーをブラウザに表示, ソースマップ付き）
- [ ] **prefresh による部分HMR**（島のステートを保持したホットスワップ。現状の full reload を置換）
- [ ] CSS の取り扱い（`.css` import, scoped styles の基礎）
- [ ] 環境変数（`.env`, ビルド時/実行時の区別, クライアント露出の安全策）
- [ ] 診断の質（解決失敗・型エラーの分かりやすい表示, コードフレーム）
- [ ] build 仕上げ: `modulepreload` マニフェスト, island の無いページでの runtime script 省略

### v0.3 「Squall」— ルーティング & データ
**テーマ**: 実用フレームワークの機能面。
**Exit基準**: 基本的な Next/Remix アプリと機能比較できる。

- [ ] ネストレイアウト（`_layout.tsx`）と共有UI
- [ ] ミドルウェア（認証・リダイレクト・ヘッダ操作）
- [ ] データ更新（`action` / form submission, Remix風 mutation）
- [ ] API routes 拡充（メソッド分岐, 型付きハンドラ, ストリーミング）
- [ ] クライアントルーター（島間SPA遷移, prefetch, スクロール復元）
- [ ] 404/500・エラーバウンダリのルート規約
- [ ] リダイレクト/ヘッダ/Cookie ヘルパ, `LoaderContext` の整備

### v0.4 「Monsoon」— バンドラーの深化
**テーマ**: 本番品質の出力と高速なビルド。これが Rust バンドラーの本丸。
**Exit基準**: 中規模アプリで Next 同等以上のビルド速度と出力品質。

- [ ] **真のチャンクバンドリング**（スコープホイスティング, island単位エントリ + 共有チャンク分割）
- [ ] ツリーシェイキング / dead code elimination（oxc_minifier フル活用）
- [ ] **永続ディスクキャッシュ**（再起動をまたぐ変換キャッシュ）
- [ ] end-to-end ソースマップ（dev/prod 両方）
- [ ] CSS modules / scoped styles の本実装, CSS コード分割
- [ ] アセット import とハッシュ（画像・フォント等）
- [ ] 循環依存対応, `rayon` でのチャンク並列コード生成

### v0.5 「Typhoon」— エコシステム & デプロイ
**テーマ**: どこにでも出せる、拡張できる。
**Exit基準**: 主要なデプロイ先に出せ、サードパーティ拡張が書ける。

- [ ] **TSRX ブリッジ**（`.tsrx`, `@tsrx/core` 経由で Preact ターゲットへ → oxc パイプライン合流）
- [ ] デプロイアダプタ（Node / 静的SSG / Edge / Bun / Deno）
- [ ] プリレンダリング（SSG）と **ストリーミング SSR**
- [ ] プラグイン API（変換フック, 仮想モジュール）
- [ ] サイドカーの抽象化（Bun/Deno をSSR実行系として選択可能に）

### v0.6 – v0.9 「Beta」— 安定化
**テーマ**: 壊れない・速い・信頼できる。
**Exit基準**: API が概ね固定され、本番採用の事例が出る。

- [ ] パフォーマンスベンチ（dev起動/HMR/ビルド/TTFB を Next と継続比較, 回帰検出をCIに）
- [ ] テストスイート拡充（変換のスナップショット, ルーティング, e2e, ハイドレーション）
- [ ] セキュリティレビュー（SSR境界, `/@fs`, サイドカー, 依存監査の継続化）
- [ ] semver 規律, 変更履歴, 非互換の明文化
- [ ] **サーバー関数（実験的）**: `"use server"` RPC（RSC的なサーバー↔クライアント境界）
- [ ] ドキュメントサイト本格版（API リファレンス, レシピ, 移行ガイド）

### v1.0 「Nowaki」— 安定版
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
| **エコシステム** | TSRX, アダプタ, プラグインAPI, サイドカー選択 |
| **品質** | テスト, ベンチ回帰検出, `cargo audit`/`npm audit` のCI化, セキュリティレビュー |
| **ドキュメント/コミュニティ** | ドキュメントサイト, レシピ, RFC, Discord/Discussions, コントリビュータ導線 |
| **リリース/レジストリ** | crates.io/npm publish 自動化, リリースCI, バージョニング, 名前/商標確保 |

---

## 公開ローンチ・チェックリスト（v0.1 の関門, ユーザー作業）

> 出力不安定化の可能性があるため、publish/購入は手元の `! コマンド` 実行が安全。順序は用意可能。

1. **名前確保（最優先・早い者勝ち）**: crates.io `nowaki`/`nowaki-core`, npm `@nowaki`/`create-nowaki`, `nowaki.dev`
2. **publish**: crates.io は `nowaki-core` → `nowaki` の順, npm は `@nowaki/runtime` → `create-nowaki`
3. **GitHub**: public 化, `nowaki-dev/maintainers`, ブランチ保護(PR必須+CI必須), Discussions 有効化
4. **ドキュメント**: Getting Started, `nowaki.dev` ランディング
5. **告知**: alpha・本番非推奨を明記した上で公開

---

## リスク・未解決の論点

- **TSRX が alpha**: API変動リスク。`TransformBridge` で隔離済みだが、依存タイミングは要監視
- **Nodeサイドカー依存**: 起動コスト/運用。将来 Bun/Deno/Edge で軽量化したい
- **Islands の粒度**: 手動の `islands/` 配置が最適か、自動判定や `"use client"` 的な指定も検討
- **prod の Rust の役割**: 現状 prod は純Node。Rust製の高速静的配信/エッジ実行をどこまで持つか
- **キャッシュ無効化の正確性**: content-hash の伝播（特に循環時）と dev の SSR 再評価
- **名前/商標**: Nowaki の商標確保、`nowaki-dev` Org の所有体制（Voredge）
