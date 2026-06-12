# Contributing to Nowaki

Thanks for your interest in contributing. Nowaki is in alpha and the
architecture is still settling, so opening an issue to discuss your idea
before writing code is the best way to avoid wasted effort.

日本語でのIssue・PRも歓迎します。

## Development setup

Prerequisites:

- Rust (stable); `rustup` recommended
- Node.js >= 22
- pnpm

```bash
git clone https://github.com/nowaki-dev/nowaki
cd nowaki
pnpm install
cargo build -p nowaki

# Run the example app
./target/debug/nowaki dev examples/hello
# → http://127.0.0.1:3000
```

## Repository layout

| Path | What it is |
|---|---|
| `crates/nowaki-core` | Bundler core: oxc-based transform pipeline, resolver, module cache |
| `crates/nowaki` | CLI binary: dev server (axum), HMR, sidecar management |
| `packages/nowaki-runtime` | `@nowaki-dev/runtime`: islands hydration client, SSR sidecar, Node loader hooks |
| `examples/hello` | Example app used for end-to-end verification |
| `DESIGN.md` | Architecture and roadmap (Japanese; translation welcome!) |

## Before you submit

- `cargo fmt` and `cargo clippy --workspace` must pass with no warnings.
- Verify the example app still works: start `nowaki dev examples/hello` and
  check that the page renders, the counter island hydrates, and editing
  `routes/index.tsx` triggers a reload.
- Keep PRs focused: one logical change per PR.

## Commit messages and sign-off

We use the [Developer Certificate of Origin](https://developercertificate.org/)
(DCO). Sign off each commit with `git commit -s`, which adds:

```
Signed-off-by: Your Name <you@example.com>
```

## Where to ask questions

- Bugs and feature requests: [GitHub Issues](https://github.com/nowaki-dev/nowaki/issues)
- Security issues: see [SECURITY.md](./SECURITY.md). Please do not open a public issue.
