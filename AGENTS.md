# AGENTS.md — working on the Nowaki codebase

Guidance for AI coding agents (Claude Code, Codex, Gemini, Cursor, Copilot, etc.)
working **on this repository** — the Nowaki framework itself. If you are building
an *app* with Nowaki, read the app guide instead: a scaffolded app ships its own
`AGENTS.md`, and the public conventions live at <https://nowaki.dev/docs>.

This file is the single source of truth; the per-agent files (`CLAUDE.md`,
`GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/`) just point here.

## What this repo is

Nowaki is a full-stack web framework with a Rust toolchain: full-stack like
Next.js, islands like Astro, installed with npm. A Rust pipeline (oxc) does
transform / resolve / bundle / serve; pages render to HTML and only `islands/`
hydrate.

```
crates/nowaki-core/   Rust library — transform, resolve, bundle, chunk (scope hoist),
                      css, server_fn, plugin bridge. JS-FREE (no JS execution).
crates/nowaki/        Rust CLI binary — dev / build / start / prerender, adapters,
                      plugin host client, Jetstream WS (live.rs).
packages/nowaki-runtime/   JS the framework runs: server/ (SSR sidecar, handler,
                      app, functions, plugin-host) + client/ (islands, router, live, hmr).
packages/create-nowaki, create-nowaki-app   scaffolders (npm create nowaki).
packages/nowaki-cli   the `nowaki` npm wrapper (prebuilt binary shim).
site/                 nowaki.dev — landing + /docs, built WITH Nowaki (dogfood).
examples/hello/       kitchen-sink app used by CLI tests + e2e.
benchmarks/           bench.mjs, head-to-head.mjs (Next/Astro), check-regression.mjs.
```

## Build, test, lint (run before you claim done)

```bash
# Rust (the core of the project)
cargo build                                          # workspace
cargo fmt --all --check                              # must be clean
cargo clippy --workspace --all-targets -- -D warnings  # must be clean
cargo test --workspace                               # unit + integration + CLI

# JS / app-level
pnpm install                                         # workspace deps (frozen in CI)
node scripts/router-test.mjs                         # router snapshot/unit test
node benchmarks/check-regression.mjs                 # client-JS size gate

# Run the example app end to end
cargo run -p nowaki -- dev examples/hello            # dev server on :3000
cargo run -p nowaki -- build examples/hello          # production build
cargo run -p nowaki -- start examples/hello          # Rust front + Node renderer
```

CI (`.github/workflows/ci.yml`) mirrors all of the above plus an e2e job that
curls the example app. Match it locally before pushing.

## Architecture facts you must not break

- **`nowaki-core` executes no JavaScript.** JS interop goes through the
  `PluginBridge` trait (implemented by the CLI's `plugins.rs` over a localhost
  HTTP plugin host). Keep the core JS-free.
- **`NowakiCore::read_source` is the single source-read chokepoint.** Plugin
  `transform`, `.tsrx` compile, virtual-module `load`, and `"use server"`
  detection all hinge on every read going through it.
- **Transforms run in several modes** — dev browser, dev SSR, build client
  (`transform_for_bundle`), build server (`transform_for_server`), and chunk
  hoisting (`chunk.rs`). A change to import handling usually needs touching all
  of them. They all apply the `react`→`preact/compat` alias.
- **Unit tests go at the END of each Rust file** (`#[cfg(test)] mod tests`).
  Placing them mid-file trips clippy's `items-after-test-module`.
- **Relative imports use explicit extensions** (`../islands/Counter.tsx`). The
  dev loader hooks and server build assume this; extensionless relative imports
  break SSR.
- **Preact, not React.** SSR uses `preact` + `preact-render-to-string`. `react*`
  specifiers are aliased to `preact/compat` across every transform path
  (`resolve.rs::alias_specifier`).

## Feature map (where things live)

- **Server functions (`"use server"`)** — `crates/nowaki-core/src/server_fn.rs`
  (detect, id, client proxy, discover) + `packages/nowaki-runtime/server/functions.mjs`
  (dispatch + `getContext`). Allowlist: `dist/server/functions.json`.
- **Jetstream islands** — `crates/nowaki/src/live.rs` (`LiveHub` + WS session),
  `server/live.mjs`, `client/live.js`. State on the server, HTML patches over WS.
- **Plugins / virtual modules** — `PluginBridge` (`transform`, `compile_tsrx`,
  `resolve_id`, `load`); `NowakiCore::resolve_spec` + the `VirtualResolve` trait.
- **Scope hoisting / chunking** — `crates/nowaki-core/src/chunk.rs`.
- **Deploy adapters** — `crates/nowaki/src/adapter.rs` (+ `server/edge-build.mjs`).

## Conventions

- Comments and user-facing strings in this repo are largely Japanese; match the
  surrounding file. Code identifiers stay English.
- Keep changes minimal and idiomatic to the surrounding code.
- Don't commit secrets or `.env`. Only `PUBLIC_*` env reaches the client.
- Commit messages end with a `Co-Authored-By:` trailer (see git history).

## Releasing (maintainers)

Versions are synced across `Cargo.toml` (`[workspace.package]`), the `nowaki`
crate's `nowaki-core` path-dep version, and the four npm `package.json`s +
`create-nowaki/template`. After bumping, run `pnpm install` so `pnpm-lock.yaml`
matches (CI uses a frozen lockfile). Then: `cargo publish -p nowaki-core` →
`-p nowaki`; push a `vX.Y.Z` tag (triggers `release.yml` for the CLI binaries);
`gh workflow run publish-npm.yml -f package=all` for runtime + scaffolders.
