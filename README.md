<div align="center">

# Nowaki (野分)

Rust製ツールチェーンを核とするフルスタックWebフレームワーク

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#status)

クライアントJSはデフォルトでゼロ。開発サーバーはRustバイナリで即起動します。Next.js の構造的な遅さへの答えとして設計しました。

</div>

---

## Nowaki とは

Nowaki（野分 = 台風の古語）は、Next.js の構造的な遅さを出発点に設計したフルスタックフレームワークです。バンドラー・変換・開発サーバーを Rust と [oxc](https://oxc.rs) で書き、レンダリングには Islands Architecture を採りました。ページが送るクライアントJSは「島」の分だけに収まります。

| Next.js の課題 | Nowaki の回答 |
|---|---|
| `next dev` の起動が遅い | Rustバイナリが即起動し、オンデマンドで変換する（例アプリで起動およそ90ms） |
| HMR が重い | oxc が単一ファイルをミリ秒級で再変換する |
| ページのJSが肥大化 | Islands により、明示した島以外はクライアントJSがゼロ |
| ビルドが遅い | oxc minifier とコンテンツハッシュキャッシュ |

> [!WARNING]
> **Status: alpha.** 設計は固まりつつありますが、APIは予告なく変わります。本番利用はまだ推奨しません。

## 特徴

- oxc（parser / transformer / codegen / resolver）の上に、オンデマンド変換パイプラインを Rust で組んでいる。
- Islands Architecture を採用。デフォルトでクライアントJSはゼロで、`islands/` 配下のコンポーネントだけがハイドレートされる。
- ファイルベースルーティングと、Remix 風の `loader`。
- npm エコシステムはそのまま使える。SSR は Rust が管理する Node サイドカー（Preact）に委譲する。

## クイックスタート

前提は Node.js 22 以上と pnpm（npm や yarn でも動きます）。Rust は要りません。CLI はプリビルドのネイティブバイナリを npm から取得します。

```bash
# 新しいアプリを作成
npm create nowaki@latest my-app
cd my-app

pnpm install   # nowaki CLI（ネイティブバイナリ）+ ランタイムを取得
pnpm dev       # → http://127.0.0.1:3000
```

scaffold 済みアプリの npm scripts:

```bash
pnpm dev         # 開発サーバー (HMR + Islands)
pnpm build       # 本番ビルド (client + server)
pnpm start       # ビルド済みアプリを配信
pnpm prerender   # 静的サイト生成 (SSG)
```

CLI を直接入れたい場合は `npm i -g nowaki`、ソースから入れたい場合は `cargo install nowaki` も使えます。

<details>
<summary>このリポジトリで開発する（コントリビューター向け）</summary>

前提: Rust (stable), Node.js >= 22, pnpm

```bash
git clone https://github.com/nowaki-dev/nowaki
cd nowaki
pnpm install
cargo build -p nowaki

# サンプルアプリで開発サーバー起動
./target/debug/nowaki dev examples/hello
# → http://127.0.0.1:3000

# 本番用にビルド（client: content-hash付きESM + manifest / server: SSR用ESM）
./target/debug/nowaki build examples/hello
# → examples/hello/dist/{client,server}/ に出力

# ビルド済みアプリを本番モードで配信
./target/debug/nowaki start examples/hello --port 3000
# → http://127.0.0.1:3000 （静的配信 + prod SSR、HMRなし）
```

</details>

## 書き味

```tsx
// routes/index.tsx — loader はサーバーでのみ実行される
import Counter from "../islands/Counter.tsx";

export const loader = async () => {
  return { message: "Nowaki へようこそ" };
};

export default function Home({ data }) {
  return (
    <main>
      <h1>{data.message}</h1>
      <Counter start={5} />   {/* この島だけがクライアントでハイドレートされる */}
    </main>
  );
}
```

ページ本体と `loader` のコードはブラウザに送られません。`islands/Counter.tsx` のJSだけが配信されます。

## プロジェクト構成

```
crates/nowaki-core       バンドラーコア (変換 / 解決 / キャッシュ)
crates/nowaki            CLI + 開発サーバー (axum) + HMR + サイドカー管理
packages/nowaki-runtime  @nowaki-dev/runtime (islandsクライアント / SSRサイドカー / Nodeローダーフック)
examples/hello           サンプルアプリ
```

設計の詳細とアーキテクチャ図は [DESIGN.md](./DESIGN.md)、今後の計画は [ROADMAP.md](./ROADMAP.md) を参照してください。

## コントリビュート

歓迎します。まずは [CONTRIBUTING.md](./CONTRIBUTING.md) をご覧ください。alpha のうちは、コードを書く前に Issue で方針を相談すると確実です。

## ライセンス

[MIT](./LICENSE) © 2026 [Voredge](https://voredge.com)

<sub>Built and maintained by Voredge. 「Nowaki」「野分」は台風を意味する日本語の古語です。</sub>
