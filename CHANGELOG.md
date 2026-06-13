# Changelog

All notable changes to Nowaki are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow
[SemVer](https://semver.org/). Nowaki is **0.x alpha**: minor versions may carry
breaking changes (documented per entry), patch versions do not.

The npm version and the milestone codename are offset — each release bundles a
milestone's worth of work; the codename is noted per entry.

## [0.6.0] — 2026-06-13 · "Jetstream"

### Added
- **Jetstream islands** — server-reactive islands (the flagship). Mark an island
  `export const live = { state, on }` and it ships **no component JavaScript**:
  state lives on the server (per WebSocket connection), `data-live` events go to
  the Rust server, which re-renders and pushes an HTML patch that a ~2 KB client
  runtime morphs in. Client islands (optimistic UI) coexist on the same page;
  static deploys serve the initial SSR and degrade gracefully.

## [0.5.0] — 2026-06-13 · "Typhoon" (complete)

### Added
- **TSRX bridge** — `.tsrx` files (TSRX statement-container syntax) compile to
  Preact via `@tsrx/preact` and run through the oxc pipeline, in dev and prod.
- **Rust production hot path** — `nowaki start` is a Rust (axum) front that
  serves static assets and assembles the HTML document (island wiring,
  modulepreload) in Rust, delegating only component rendering to a Node sidecar.

## [0.4.0] — 2026-06-13 · "Typhoon" (core)

### Added
- **Deploy adapters** — `nowaki build --adapter <node|static|bun|deno|cloudflare>`:
  a self-contained Node server, static (SSG), Bun/Deno, and a Cloudflare Workers
  (edge) worker.
- **Streaming SSR** — opt-in per route with `export const streaming = true`.
- **Plugin API** — `nowaki.config` `transform(code, id)` hooks (dev + build).

## [0.3.0] — 2026-06-13 · "Monsoon"

### Added
- **Production bundler** — true chunk bundling with scope hoisting, tree-shaking,
  a persistent disk cache, end-to-end source maps, CSS Modules, hashed asset
  imports, and cyclic-dependency handling.
- **Next.js migration** — `react` / `react-dom` alias to `preact/compat`, so
  React-style code and React libraries run unchanged on a single Preact instance.

## [0.2.0] — 2026-06-13 · "Squall"

### Added
- **Routing & data** — nested `_layout`s, `_middleware`, server `loader`s, form
  `action`s, API routes with method dispatch and streaming, `_404`/`_500`, a
  `LoaderContext` (cookies/headers/redirect/json/formData), and an
  island-to-island SPA router.
- **npm-only install** — the CLI ships as prebuilt native binaries via npm's
  optional dependencies; no Rust toolchain required.

## [0.1.0] — [0.1.1] — 2026-06-12 · "Gust" / "Breeze"

### Added
- Initial public alpha: `nowaki dev` / `build` / `start` / `prerender`, islands
  architecture with on-demand oxc transforms, a full-screen error overlay,
  code-frame diagnostics, island hot-swap HMR, `.env` (`PUBLIC_*` exposure), and
  global CSS import.
- Published to crates.io (`nowaki-core`, `nowaki`) and npm (`@nowaki-dev/runtime`,
  `create-nowaki`, `create-nowaki-app`).

[0.6.0]: https://github.com/nowaki-dev/nowaki/releases/tag/v0.6.0
[0.5.0]: https://github.com/nowaki-dev/nowaki/releases/tag/v0.5.0
[0.4.0]: https://github.com/nowaki-dev/nowaki/releases/tag/v0.4.0
[0.3.0]: https://github.com/nowaki-dev/nowaki/releases/tag/v0.3.0
[0.2.0]: https://github.com/nowaki-dev/nowaki/releases/tag/v0.2.0
[0.1.1]: https://github.com/nowaki-dev/nowaki/releases/tag/v0.1.1
