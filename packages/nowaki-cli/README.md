# nowaki

The Nowaki CLI: a Rust-powered bundler, dev server, and static-site generator for the [Nowaki](https://nowaki.dev) web framework.

This package ships a small Node wrapper that runs a prebuilt native binary for your platform. No Rust toolchain required.

## Install

Per project (recommended):

```bash
npm install --save-dev nowaki
# or: pnpm add -D nowaki
```

Globally:

```bash
npm install -g nowaki
nowaki --version
```

## Usage

```bash
nowaki dev [dir]          # 開発サーバー (HMR + Islands ハイドレーション)
nowaki build [dir]        # 本番ビルド (client + server)
nowaki start [dir]        # ビルド済みアプリを配信
nowaki prerender [dir]    # 静的サイト生成 (SSG)
```

Scaffold a new app with `npm create nowaki@latest my-app`.

## How it works

The native binary is distributed as platform-specific optional dependencies
(`@nowaki-dev/cli-darwin-arm64`, `@nowaki-dev/cli-linux-x64-gnu`, …). npm/pnpm
installs only the one matching your `os`/`cpu`/`libc`, and this wrapper resolves
and executes it. There is no `postinstall` step, so it works with
`--ignore-scripts` too.

Prefer building from source? `cargo install nowaki` also works.

## License

MIT
