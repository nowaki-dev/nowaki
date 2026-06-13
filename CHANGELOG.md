# Changelog

All notable changes to Nowaki are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow
[SemVer](https://semver.org/). Nowaki is **0.x alpha**: minor versions may carry
breaking changes (documented per entry), patch versions do not.

The npm version and the milestone codename are offset — each release bundles a
milestone's worth of work; the codename is noted per entry.

## [0.10.0] — 2026-06-13 · DevEx

### Added
- **Interactive `npm create nowaki` wizard** (dependency-free) — prompts for
  project name, package manager (auto-detected), git init, and dependency
  install; sets the package name and tailors the next steps. Non-interactive
  runs (`-y`, CI, pipes) scaffold with defaults and never auto-install (use
  `--install` to opt in). Flags: `-y/--yes`, `--install`, `--no-install`,
  `--no-git`, `--pm`.
- **dev/start banners** — `nowaki dev` and `nowaki start` print a clean banner
  (version, Local URL, ready time, active features). `--host` exposes the server
  on the LAN and shows the Network URL; `nowaki dev --open` opens the browser.
  Color respects `NO_COLOR` and non-TTY.
- **Fuller scaffold** — new apps now include `tsconfig.json` (Preact JSX, bundler
  resolution, `.tsx` extensions, `react`→`preact/compat` paths), `nowaki-env.d.ts`
  (css/asset/virtual/`import.meta.env` ambient types), a `README.md`, and a
  `.gitignore`, so editors give correct IntelliSense out of the box.
- **`nowaki build` summary** — build time, client modules/islands/JS size, server
  modules, and output path.

### Changed
- Missing-dependency errors are now actionable and package-manager-agnostic.
- The runtime (`@nowaki-dev/runtime`) is unchanged and stays at 0.9.0.

## [0.9.1] — 2026-06-13 · scaffolder patch

### Added
- Scaffolded apps (`npm create nowaki`) now ship `AGENTS.md` + `CLAUDE.md` so AI
  coding agents know Nowaki's conventions (islands, loaders/actions, API routes,
  `"use server"`, Jetstream) out of the box. Only `create-nowaki` and
  `create-nowaki-app` move to 0.9.1; the runtime and CLI stay at 0.9.0.

## [0.9.0] — 2026-06-13 · "Beta" (v0.8–v0.9 band)

### Added
- **Server functions (`"use server"`)** — a module with a top-of-file
  `"use server"` directive becomes an RPC boundary. Its exports run only on the
  server; the client gets a tiny `fetch` proxy (implementation and server-only
  deps are stripped from the bundle). Dispatch is allowlisted by a stable
  `module#export` id (the client can't reach arbitrary exports); `getContext()`
  exposes the request's cookies/headers via AsyncLocalStorage. Works in dev,
  `nowaki start`, and on edge adapters.
- **Plugin virtual modules** — plugins gain `resolveId(source, importer)` and
  `load(id)` hooks for modules that don't exist on disk. Client imports bundle
  the generated source inline; SSR inlines it as a self-contained `data:` module.
  Only invoked when normal resolution fails — zero overhead otherwise.
- **Jetstream presence + connection scaling** — a shared hub broadcasts the live
  connection count (`{type:"presence",count}`, mirrored into
  `[data-nowaki-presence]`), pings/expires idle connections (heartbeat), and caps
  concurrent connections (`NOWAKI_LIVE_MAX`), degrading gracefully over the cap.
- **Head-to-head benchmarks** — `benchmarks/head-to-head.mjs` compares Nowaki,
  Next.js, and Astro on the same one-counter app (measuring only what's
  installed, never fabricating). A `bench-regression` CI job gates the
  deterministic client-JS size against `benchmarks/baseline.json`.
- **Documentation site** — `/docs` (built with Nowaki, zero client JS): Overview,
  Quickstart, Routing, Server functions, Jetstream, Plugins, Deploy, and a
  Migrate-from-Next.js guide.

### Notes
- State-preserving (prefresh) HMR remains a follow-up; island hot-swap already
  gives fast feedback. Scoped CSS for TSRX islands also remains on the roadmap.

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
