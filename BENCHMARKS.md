# Benchmarks

Honest, reproducible numbers — measured with the **release** binary on the apps
in this repo. Two harnesses: `bench.mjs` (Nowaki's own numbers) and
`head-to-head.mjs` (a like-for-like comparison against Next.js and Astro on the
same app). We measure what's actually installed and never fabricate a number.

Reproduce:

```bash
cargo build --release -p nowaki
node benchmarks/bench.mjs site            # a clean content-first app
node benchmarks/bench.mjs examples/hello  # a kitchen-sink app
node benchmarks/head-to-head.mjs          # Nowaki vs Next vs Astro (same counter app)
```

## Head-to-head: Nowaki vs Next.js vs Astro

The same minimal app — one server-rendered page with a single interactive
counter island (Preact for Nowaki *and* Astro, so the UI library is equal) —
built and booted on one machine.

| framework | dev ready (cold) | production build | first-load JS (raw) | first-load JS (gzip) |
|---|---|---|---|---|
| **Nowaki** | **74 ms** | **10 ms** | **21.6 KB** | **9.9 KB** |
| Astro | 544 ms | 999 ms | 23.1 KB | 10.0 KB |
| Next.js | 1374 ms | 7580 ms | 103.0 KB\* | — |

\* Next's own *First Load JS* figure from `next build` (parsed/uncompressed). For
Nowaki and Astro, *raw* is the summed uncompressed size of the production client
chunks and *gzip* is what's transferred.

Reading it: Nowaki boots dev ~7× faster than Astro and ~18× faster than Next,
builds ~100× faster than Astro and ~750× faster than Next, and ships about the
same tiny client payload as Astro (both are islands frameworks) — roughly **5×
less than Next's app-router baseline**. The apps live in
`benchmarks/apps/{nowaki,next,astro}-counter`; install the peers and re-run
`head-to-head.mjs` to reproduce on your machine.

> The numbers move run-to-run and machine-to-machine; the *orders of magnitude*
> are the point, not the third digit. The harness skips any framework whose
> toolchain isn't installed rather than guessing.

A CI job (`bench-regression`) also gates the deterministic part — the gzipped
client JS of `nowaki-counter` — against `benchmarks/baseline.json`, failing the
build if a change inflates the bundle by more than 12 %.

## `site/` — 2 pages, no plugins (typical content-first app)

| metric | value |
|---|---|
| dev server ready (cold) | ~70 ms |
| dev server ready (warm cache) | ~90 ms |
| production build | ~15 ms |
| shipped client JS (gzip, per file) | ~14 KB |
| TTFB (`nowaki start`, `/`) | ~50 ms |

This is the number behind the landing page's "dev ready in about 90 ms": a real
content app boots in well under 100 ms.

## `examples/hello` — kitchen sink (many islands, `.tsrx`, a config plugin, a Jetstream island)

| metric | value |
|---|---|
| dev server ready (cold) | ~670 ms |
| dev server ready (warm cache) | ~160 ms |
| production build | ~130 ms |
| shipped client JS (gzip, per file) | ~18 KB |
| TTFB (`nowaki start`, `/`) | ~45 ms |

The kitchen-sink app is slower to boot because it also starts the Node **plugin
host** (it has a config plugin and `.tsrx` islands compiled by `@tsrx/preact`).
That overhead only applies to apps that use plugins or TSRX — a plain app pays
none of it (see `site/` above).

## Methodology

- **Machine/run dependent.** Numbers are representative of one machine; treat
  them as orders of magnitude, not guarantees. Re-run locally for your setup.
- **dev server ready** = wall time from spawning `nowaki dev` to the
  `dev server ready` line on stdout. *cold* clears `node_modules/.cache/nowaki`
  first; *warm* is the second run (persistent disk cache hot).
- **production build** = wall time of `nowaki build` (cold cache).
- **shipped client JS** = sum of the gzipped size of each `dist/client/*.js`
  chunk (i.e. bytes actually transferred per file). This is more conservative
  than gzipping all chunks as one stream; the landing page quotes the combined
  figure, which is ~1–2 KB smaller.
- **TTFB** = time to the first byte of `GET /` from `nowaki start` (the Rust
  front), after the server reports ready.
