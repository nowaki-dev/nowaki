# CLAUDE.md

This app's agent guidance is in **[AGENTS.md](./AGENTS.md)** — read it first.

TL;DR: Nowaki renders pages to HTML; only components under `islands/` ship JS and
hydrate. Write **Preact** (hooks from `preact/hooks`), use **explicit file
extensions** in relative imports, put interactive components in `islands/`, and
use route `loader`/`action`, `routes/api/*.ts`, `"use server"` modules, or
Jetstream islands (`export const live`) as needed. Commands: `npm run dev`,
`npm run build`, `npm run start`. Docs: https://nowaki.dev/docs
