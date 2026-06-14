# AGENTS.md — building this Nowaki app

Guidance for AI coding agents (Claude Code, Codex, Gemini, Cursor, Copilot, Grok,
Kimi, …) working in this app. Nowaki is a full-stack framework with a Rust
toolchain: pages render to HTML on the server, and only the components under
`islands/` ship JavaScript and hydrate. Full docs: <https://nowaki.dev/docs>.

## Commands

```bash
npm run dev        # nowaki dev   — dev server with hot reload (http://localhost:3000)
npm run build      # nowaki build — production build (dist/client + dist/server)
npm run start      # nowaki start — serve the production build
npm run prerender  # nowaki prerender — static export
```

## Project layout

```
routes/      file-based routes (pages + API). _layout.tsx, _middleware.ts,
             _404.tsx, _500.tsx, [slug].tsx, api/*.ts
islands/     interactive components — THE ONLY things that ship JS and hydrate
components/  shared server components (no client JS)
lib/         shared server code
actions/     "use server" RPC modules (optional)
nowaki.config.mjs   plugins (optional)
```

## Rules — follow these when generating code

1. **Preact, not React.** Import hooks from `preact/hooks`
   (`import { useState } from "preact/hooks"`). `react`, `react-dom`, and
   `react/jsx-runtime` are aliased to `preact/compat`, so many React libraries
   work, but write Preact.
2. **Interactivity lives in `islands/`.** A component with `useState`, event
   handlers, effects, etc. must be a file under `islands/`. A route or component
   that imports an island stays server-HTML; only the island hydrates. Don't put
   `onClick`/hooks in route or `components/` files.
3. **Use explicit file extensions in relative imports**:
   `import Counter from "../islands/Counter.tsx"` (not `"../islands/Counter"`).
4. **Routes** are components with an optional server-only `loader` and `action`.
   Optional types come from `@nowaki-dev/runtime` — `PageProps<typeof loader>`
   infers the page's `data`, `LoaderContext` types `params`/cookies/headers:
   ```tsx
   // routes/blog/[slug].tsx
   import type { LoaderContext, PageProps } from "@nowaki-dev/runtime";
   export const loader = async ({ params }: LoaderContext) => ({ post: await db.post(params.slug) }); // server-only
   export async function action(ctx: LoaderContext) {  // runs on non-GET requests
     const form = await ctx.formData();
     return ctx.redirect("/blog");                 // Post/Redirect/Get
   }
   export default function Post({ data }: PageProps<typeof loader>) { return <article><h1>{data.post.title}</h1></article>; }
   ```
   A catch-all segment `routes/files/[...path].tsx` matches `/files/a/b/c`;
   `params.path` is the array `["a","b","c"]`. Add `export const revalidate = 60`
   (seconds) to a route for ISR: the HTML is cached and regenerated in the
   background when stale (don't put per-user data on an ISR page).
5. **API routes** are `routes/api/*.ts` with per-method exports; return a value
   (JSON-encoded) or a `Response`:
   ```ts
   export const GET = (ctx) => ctx.json({ ok: true });
   export const POST = async (ctx) => ctx.json({ got: await ctx.bodyJson() });
   ```
6. **Islands** are default-exported components:
   ```tsx
   // islands/Counter.tsx
   import { useState } from "preact/hooks";
   export default function Counter({ start = 0 }) {
     const [n, setN] = useState(start);
     return <button onClick={() => setN(n + 1)}>count: {n}</button>;
   }
   ```
7. **Server functions** — a module with a top-of-file `"use server"` directive
   becomes RPC; the client gets a tiny fetch proxy, the implementation stays on
   the server. Validate arguments; read auth via `getContext()`:
   ```ts
   // actions/todos.ts
   "use server";
   import { getContext } from "@nowaki-dev/runtime";
   export async function addTodo(text: string) { /* runs on the server */ }
   ```
   Call it from an island like a normal async function:
   `import { addTodo } from "../actions/todos.ts";`
8. **Jetstream islands** (server-reactive, zero client JS) — give an island
   `export const live = { state, on }`; buttons use `data-live="handler"` instead
   of `onClick`. State lives on the server; the server pushes HTML patches.

## Don't

- Don't add a build tool (Vite/webpack/Babel) or a `tsconfig` paths setup — the
  Rust toolchain handles transform/resolve/bundle.
- Don't import React directly hoping for React internals; it's Preact under the hood.
- Don't put interactive components outside `islands/`.
- Don't read secrets on the client. Only `PUBLIC_*` env vars reach the browser;
  everything else is server-only (loaders, actions, server functions).
