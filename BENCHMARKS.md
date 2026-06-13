# Benchmarks

Honest, reproducible numbers — measured with the **release** binary on the apps
in this repo. These are Nowaki's *own* numbers, not a head-to-head against
Next.js or Astro. A like-for-like comparison needs equivalent apps and a shared
harness; that's on the roadmap (Beta). We'd rather ship real measurements now
than a fabricated scoreboard.

Reproduce:

```bash
cargo build --release -p nowaki
node benchmarks/bench.mjs site            # a clean content-first app
node benchmarks/bench.mjs examples/hello  # a kitchen-sink app
```

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
