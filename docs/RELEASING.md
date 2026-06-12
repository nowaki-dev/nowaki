# リリース手順

Nowaki は2系統で配布する:

- **crates.io** — `nowaki` / `nowaki-core`（`cargo install nowaki`）
- **npm** — `nowaki`（プリビルドバイナリの wrapper）+ `@nowaki-dev/cli-<platform>` ×5、`@nowaki-dev/runtime`、`create-nowaki`

npm の CLI は esbuild/biome 方式: プラットフォーム別バイナリを `optionalDependencies`
で配り、`packages/nowaki-cli/bin/nowaki.js`（postinstall 不要のシム）が実行時に解決して
exec する。

## 前提（一度だけ）

リポジトリの **Secrets に `NPM_TOKEN`** を登録する（npm の Automation token、
`@nowaki-dev` org と未スコープ `nowaki` に publish 権限があること）。

## バージョンを上げる

以下を同じバージョンに揃える:

1. `Cargo.toml` の `[workspace.package] version`（crate と、`build-npm.mjs` が読む元）
2. `packages/nowaki-cli/package.json` の `version` と `optionalDependencies` の各 `@nowaki-dev/cli-*`
3. （必要なら）`packages/create-nowaki/template/package.json` の `devDependencies.nowaki`

## 公開する

### crates.io

```bash
cargo publish -p nowaki-core
cargo publish -p nowaki
```

### npm CLI（自動）

バージョンタグを push するとリリース CI（`.github/workflows/release.yml`）が
5プラットフォームをビルドして全パッケージを publish する:

```bash
git tag v0.1.2
git push origin v0.1.2
```

- `build` ジョブ: 各ターゲットをビルド → `node scripts/build-npm.mjs <key> --no-build`
  でパッケージ化 → `@nowaki-dev/cli-<key>` を publish。
- `publish-wrapper` ジョブ: 全ビルド後に wrapper `nowaki` を publish。
- 手動実行（workflow_dispatch）で `dry_run=true` にするとビルドのみ。

### npm runtime / create-nowaki（手動）

```bash
cd packages/nowaki-runtime && npm publish
cd packages/create-nowaki   && npm publish
cd packages/create-nowaki-app && npm publish
```

## ローカル動作確認

任意のターゲットを手元で組み立てて確認できる（ホストと同じ key のみ実行可能）:

```bash
node scripts/build-npm.mjs darwin-arm64   # 例: Apple Silicon
# 生成物: packages/nowaki-cli/npm/darwin-arm64/{package.json, bin/nowaki}
```

CI の `npm CLI wrapper (smoke)` ジョブ（`ci.yml`）が、ホスト用パッケージを組み立てて
wrapper シム経由で `nowaki --version` が通ることを毎 PR で検証する。
