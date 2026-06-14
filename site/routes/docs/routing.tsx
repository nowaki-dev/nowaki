export const lang = "en";
export const title = "Nowaki docs — Routing & data";

export default function Routing() {
  return (
    <>
      <h1>Routing &amp; data</h1>
      <p class="lead">
        File-based routes with nested layouts, middleware, server loaders, form actions, and API
        routes. If you've used Next.js or Remix, this will feel familiar.
      </p>

      <h2>File conventions</h2>
      <table>
        <tr><th>File</th><th>Maps to</th></tr>
        <tr><td><code>routes/index.tsx</code></td><td><code>/</code></td></tr>
        <tr><td><code>routes/about.tsx</code></td><td><code>/about</code></td></tr>
        <tr><td><code>routes/blog/[slug].tsx</code></td><td><code>/blog/:slug</code> (dynamic param)</td></tr>
        <tr><td><code>routes/files/[...path].tsx</code></td><td><code>/files/*</code> (catch-all; <code>params.path</code> is an array)</td></tr>
        <tr><td><code>routes/api/posts.ts</code></td><td><code>/api/posts</code> (handler, not a page)</td></tr>
        <tr><td><code>routes/_layout.tsx</code></td><td>Wraps pages in its directory (nests)</td></tr>
        <tr><td><code>routes/_middleware.ts</code></td><td>Runs before routes (nests)</td></tr>
        <tr><td><code>routes/_404.tsx</code> · <code>_500.tsx</code></td><td>Not-found / error pages</td></tr>
      </table>
      <p>Static segments win over dynamic ones at the same depth, so <code>/users/me</code> beats <code>/users/[id]</code>, and a catch-all <code>[...path]</code> only matches once nothing more specific does.</p>

      <h2>Loaders run on the server</h2>
      <p>
        A route can export a <code>loader</code>. It runs only on the server (so secrets and DB
        access stay there) and its result is passed to the page as <code>data</code>.
      </p>
      <pre><code>{`// routes/blog/[slug].tsx
import type { LoaderContext, PageProps } from "@nowaki-dev/runtime";

export const loader = async ({ params }: LoaderContext) => ({
  post: await db.post(params.slug),   // server-only
});

export default function Post({ data }: PageProps<typeof loader>) {
  return <article><h1>{data.post.title}</h1></article>;   // data is fully typed
}`}</code></pre>
      <p>
        The optional types ship with <code>@nowaki-dev/runtime</code>: <code>PageProps&lt;typeof
        loader&gt;</code> infers the page's <code>data</code> from the loader's return type, and
        <code>LoaderContext</code> types <code>params</code>, cookies, headers, and the request
        helpers. JavaScript routes work too; the types are there when you want them.
      </p>

      <h2>Actions handle mutations</h2>
      <p>
        A non-GET request runs the route's <code>action</code>. Return a <code>Response</code>,
        <code>ctx.redirect()</code> (Post/Redirect/Get), or data to re-render the page with.
      </p>
      <pre><code>{`// routes/guestbook.tsx
export async function action(ctx) {
  const form = await ctx.formData();
  ctx.setCookie("guestbook", add(form.get("msg")));
  return ctx.redirect("/guestbook");   // PRG
}`}</code></pre>

      <h2>Layouts &amp; middleware nest</h2>
      <p>
        <code>_layout.tsx</code> wraps every page under its directory and composes from root to leaf.
        <code>_middleware.ts</code> runs before the route (root → leaf); return a <code>Response</code> to
        short-circuit — useful for auth, redirects, and response headers.
      </p>
      <pre><code>{`// routes/_middleware.ts
export default function (ctx) {
  if (ctx.url.pathname.startsWith("/admin") && !ctx.cookies.session) {
    return ctx.redirect("/login");
  }
  ctx.setHeader("x-frame-options", "DENY");
}`}</code></pre>

      <h2>API routes</h2>
      <p>
        Files under <code>routes/api/</code> are handlers. Export per-method functions
        (<code>GET</code>, <code>POST</code>, …) or a <code>default</code>; return a
        <code>Response</code> (streaming supported) or a value to JSON-encode. Unmatched methods get a
        405.
      </p>
      <pre><code>{`// routes/api/echo.ts
export const GET = (ctx) => ctx.json({ q: ctx.url.searchParams.get("q") });
export const POST = async (ctx) => ctx.json({ received: await ctx.bodyJson() });`}</code></pre>

      <h2>Streaming SSR</h2>
      <p>
        Opt a route into streaming with <code>export const streaming = true</code>; the shell is sent
        first and the body streams in, lowering time-to-first-byte for slow pages.
      </p>

      <h2>Incremental static regeneration (ISR)</h2>
      <p>
        Export <code>revalidate</code> (seconds) and the rendered HTML is cached and served instantly,
        then regenerated in the background once it goes stale. The first request after the window gets
        the cached (stale) HTML while a fresh render runs, so no one waits on a slow loader.
      </p>
      <pre><code>{`// routes/blog/[slug].tsx
export const revalidate = 60;   // cache for 60s, then revalidate

export const loader = async ({ params }) => ({ post: await db.post(params.slug) });`}</code></pre>
      <p>
        Under <code>nowaki start</code>, the Rust front keeps the cache in memory (single-flight
        revalidation, an <code>x-nowaki-cache: HIT&#8202;|&#8202;STALE&#8202;|&#8202;MISS</code> header
        per response). Nowaki also sends <code>Cache-Control: s-maxage, stale-while-revalidate</code>,
        so the same page gets ISR for free on a CDN or edge adapter (Cloudflare, Vercel). Responses
        that set a cookie are treated as per-user and never cached, so keep ISR pages free of
        request-specific data.
      </p>

      <div class="pager">
        <a href="/docs/quickstart">← Quickstart</a>
        <a href="/docs/server-functions">Server functions →</a>
      </div>
    </>
  );
}
