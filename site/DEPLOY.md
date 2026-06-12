# Deploying nowaki.dev

The landing (`site/`) is fully static — two pages, `/` and `/ja`, with no
per-request data — so it ships to any static host. We pre-render it (with
Nowaki) and deploy to Cloudflare Pages.

## 1. Pre-render to static files

```bash
nowaki prerender site --out public
```

(`site/scripts/prerender.sh` is the equivalent manual flow if you don't have
the `nowaki` binary on PATH.) Outputs `site/public/`:

- `index.html` (`/`), `ja/index.html` (`/ja`)
- `_nowaki/*` — content-hashed client assets (islands runtime + island chunks)
- `_headers` — immutable cache for `/_nowaki/*`

Requires `nowaki` on `PATH` (`cargo install nowaki`) and a prior `pnpm install`
in `site/`. The islands still hydrate client-side from `/_nowaki/`, so the page
is interactive on a purely static host.

## 2. Deploy to Cloudflare Pages (direct upload)

```bash
npx wrangler login                  # or export CLOUDFLARE_API_TOKEN=...
npx wrangler pages deploy site/public --project-name nowaki
```

The first run creates the `nowaki` Pages project; later runs publish a new
version. (DNS for nowaki.dev is already on Cloudflare.)

## 3. Attach the domain

Cloudflare dashboard → **Workers & Pages → nowaki → Custom domains** → add
`nowaki.dev` (and `www.nowaki.dev` if desired).

## Notes

- Cloudflare Pages reserves `_headers` / `_redirects` / `_routes.json`; the
  `_nowaki/` asset directory is served normally.
- Tailwind is loaded via the Play CDN and fonts via Google Fonts at runtime.
  A follow-up can precompile Tailwind to drop the runtime CSS cost.
- This is a manual pre-render; a built-in `nowaki` SSG/prerender command is a
  roadmap item (see ROADMAP.md, v0.5).
