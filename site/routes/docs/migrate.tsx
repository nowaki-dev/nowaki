export const lang = "en";
export const title = "Nowaki docs — Migrate from Next.js";

export default function Migrate() {
  return (
    <>
      <h1>Migrate from Next.js</h1>
      <p class="lead">
        Nowaki keeps the parts of Next.js that make it productive and swaps the runtime model:
        HTML-first with islands, on a Rust toolchain. Here's how the concepts line up.
      </p>

      <h2>Concept mapping</h2>
      <table>
        <tr><th>Next.js</th><th>Nowaki</th></tr>
        <tr><td><code>app/page.tsx</code> / <code>pages/</code></td><td><code>routes/index.tsx</code> (file-based)</td></tr>
        <tr><td><code>app/layout.tsx</code></td><td><code>routes/_layout.tsx</code> (nests per directory)</td></tr>
        <tr><td>Middleware</td><td><code>routes/_middleware.ts</code> (nests)</td></tr>
        <tr><td>Server Components / <code>getServerSideProps</code></td><td>route <code>loader</code> (server-only, returns <code>data</code>)</td></tr>
        <tr><td>Server Actions</td><td>route <code>action</code> + <code>"use server"</code> functions</td></tr>
        <tr><td><code>"use client"</code> components</td><td>components under <code>islands/</code></td></tr>
        <tr><td>Route handlers (<code>route.ts</code>)</td><td><code>routes/api/*.ts</code> (per-method exports)</td></tr>
        <tr><td><code>[slug]</code> dynamic routes</td><td><code>[slug]</code> dynamic routes</td></tr>
        <tr><td>React</td><td>Preact, with <code>react</code> → <code>preact/compat</code> aliasing</td></tr>
      </table>

      <h2>The big difference: islands, not "use client"</h2>
      <p>
        In Next, a page is a React tree and you carve out server vs client boundaries. In Nowaki, a
        page is HTML by default and you opt specific components <em>into</em> the browser by putting
        them in <code>islands/</code>. The mental shift: instead of asking "what can be a server
        component?", ask "what actually needs to be interactive?". Everything else ships zero JS.
      </p>

      <h2>React libraries</h2>
      <p>
        Nowaki aliases <code>react</code>, <code>react-dom</code>, and <code>react/jsx-runtime</code>
        to their <code>preact/compat</code> equivalents, so many React libraries work unchanged in
        your islands. Hooks (<code>useState</code>, <code>useEffect</code>, …) come from
        <code>preact/hooks</code> or through the compat layer.
      </p>

      <h2>Data &amp; mutations</h2>
      <pre><code>{`// Next: getServerSideProps        →  Nowaki: export const loader
export const loader = async ({ params }) => ({ post: await db.post(params.slug) });

// Next: Server Action             →  Nowaki: "use server" function
// actions/posts.ts
"use server";
export async function like(id) { /* ...runs on the server... */ }`}</code></pre>

      <h2>What to expect</h2>
      <ul>
        <li>Use explicit file extensions in relative imports (<code>../islands/Counter.tsx</code>).</li>
        <li>No app-router streaming/Suspense semantics yet; Nowaki has opt-in <code>streaming = true</code> per route.</li>
        <li>Nowaki is alpha — APIs can still shift. Start with a small surface and grow.</li>
      </ul>

      <div class="note">
        Goal: a Next.js developer should be able to read a Nowaki app and know where everything goes
        within minutes. If something doesn't map cleanly, that's a gap worth filing on GitHub.
      </div>

      <div class="pager">
        <a href="/docs/deploy">← Deploy</a>
        <a href="/docs">Back to overview →</a>
      </div>
    </>
  );
}
