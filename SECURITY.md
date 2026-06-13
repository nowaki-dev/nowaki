# Security Policy

## Supported versions

Nowaki is in alpha; only the latest release (and `main`) receives security
fixes.

## Reporting a vulnerability

Please report security issues privately to **dev@voredge.com** — do not open
a public GitHub issue. Include reproduction steps and the affected version or
commit. We aim to acknowledge reports within 72 hours.

Note: the dev server (`nowaki dev`) is a development tool. It serves files
from the local filesystem (e.g. `/@fs/`) by design and must never be exposed
to untrusted networks. Reports about the dev server are still welcome, but
production-facing issues (`nowaki build` output, SSR runtime) take priority.

## Security model & boundaries

Where the trust boundaries are, so reviewers know what to look at:

- **`/@fs/` filesystem serving is dev-only.** `nowaki dev` resolves and serves
  arbitrary files (pnpm store realpaths, etc.) to make on-demand transforms
  work. The production paths (`nowaki start`, the deploy adapters) never expose
  `/@fs/`; they serve only `dist/`. Treat `nowaki dev` as localhost-only.
- **Sidecars and hosts bind to localhost.** The SSR sidecar, the prod-sidecar,
  the plugin host, and the Jetstream `/__nowaki/live-render` endpoint listen on
  `127.0.0.1` on ephemeral ports and are reached only by the local Rust process.
  They are not meant to be exposed directly.
- **Static asset serving uses basenames.** `/_nowaki/<file>` is resolved by
  basename against `dist/client`, so path traversal (`../`) cannot escape it.
- **Secrets stay server-side.** Only `import.meta.env.PUBLIC_*` (and `MODE`) are
  inlined into client code; other `.env` values are never sent to the browser.
  `.env*` files are gitignored.
- **Plugins and TSRX run your own dev/build dependencies.** A `nowaki.config`
  plugin and `@tsrx/preact` execute as Node code during dev/build with your
  project's privileges — treat them like any build dependency. They do not run
  in the production request path.
- **Jetstream state is per-connection, server-held.** A Jetstream island's state
  lives in the Rust process for the lifetime of one WebSocket connection; event
  handlers run on the Node sidecar. Validate inputs in your `on` handlers as you
  would any server handler.
- **Server functions (`"use server"`) are an allowlisted RPC surface.** Only the
  exports of `"use server"` modules are callable, via a build-time id→{module,
  export} allowlist (`dist/server/functions.json`; the client never sends the
  module/export, only an opaque id). A client cannot reach an arbitrary export.
  The function implementation and its server-only imports are stripped from the
  client bundle — the browser receives a `fetch` proxy only. Treat each server
  function like a public HTTP endpoint: **validate its arguments** (they arrive
  as JSON from the client) and check authorization via `getContext()` (request
  cookies/headers). Errors return only `error.message` to the client, never the
  stack.

## Dependency auditing

CI runs `cargo audit` (RustSec advisories) and `pnpm audit` on every push. To
check locally:

```bash
cargo audit
pnpm audit --prod
```
