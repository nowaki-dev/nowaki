# Nowaki app

A full-stack app built with [Nowaki](https://nowaki.dev) — full-stack like
Next.js, islands like Astro, on a Rust toolchain. Pages render to HTML; only the
components under `islands/` ship JavaScript and hydrate.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run prerender`.
Pass `--host` to expose dev on your LAN, `--open` to open the browser:
`npm run dev -- --host --open`.

## Update

```bash
npx nowaki upgrade        # bumps nowaki (CLI) and @nowaki-dev/runtime to latest
```

`nowaki upgrade` detects your package manager and updates both packages,
rewriting the `package.json` ranges. (A plain `npm update` won't cross a
`0.x` minor, so prefer `nowaki upgrade` — or install `@latest` by hand.)
Pin a version with `--to`, e.g. `npx nowaki upgrade --to 0.11.0`. Pre-1.0,
check the release notes before upgrading; minors can include breaking changes.

## Structure

```
routes/      pages + API (file-based). _layout.tsx, _middleware.ts, [slug].tsx, api/*.ts
islands/     interactive components — the only things that ship JS
components/  shared server components (no client JS)
lib/         shared server code
actions/     "use server" RPC modules (optional)
```

## Notes

- Write **Preact** — import hooks from `preact/hooks`. (`react` is aliased to
  `preact/compat`, so many React libraries work.)
- Use **explicit file extensions** in relative imports: `../islands/Counter.tsx`.
- A route's `loader` runs only on the server; `action` handles non-GET requests.
- `AGENTS.md` documents the conventions for AI coding agents.

Docs: <https://nowaki.dev/docs>
