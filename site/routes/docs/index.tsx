export const lang = "en";
export const title = "Nowaki docs — Overview";

export default function Overview() {
  return (
    <>
      <h1>Nowaki <span class="badge">alpha</span></h1>
      <p class="lead">
        A full-stack web framework with a Rust toolchain. Full-stack like Next.js, islands like
        Astro, installed with npm — no Rust required.
      </p>

      <p>
        Nowaki (野分) renders your pages to HTML on the server and hydrates only the components you
        mark as <em>islands</em>. The whole build pipeline — transform, resolve, bundle, serve — runs
        in Rust on top of <a href="https://oxc.rs">oxc</a>, so the dev server is ready in tens of
        milliseconds and a changed file re-transforms in single-digit milliseconds.
      </p>

      <h2>Why it exists</h2>
      <p>
        Most JavaScript frameworks run their toolchain on a JavaScript toolchain. Nowaki moves that
        pipeline to Rust while keeping the things that make Next.js productive — file-based routing,
        layouts, middleware, server data loading, actions, API routes — and keeps the npm ecosystem
        for SSR. You write Preact (with a <code>react</code> → <code>preact/compat</code> alias for
        libraries), and you ship almost no client JavaScript by default.
      </p>

      <h2>The three pillars</h2>
      <table>
        <tr>
          <th>Rust toolchain</th>
          <td>Transform/resolve/bundle/serve in Rust (oxc). Fast cold start, millisecond rebuilds, scope-hoisted production output.</td>
        </tr>
        <tr>
          <th>Zero JS by default</th>
          <td>Pages are HTML. Only components under <code>islands/</code> hydrate. A content page ships 0 KB of JS.</td>
        </tr>
        <tr>
          <th>npm-compatible</th>
          <td>SSR runs on Node (or Bun/Deno/edge). Use your existing npm packages; the CLI installs as a prebuilt native binary.</td>
        </tr>
      </table>

      <h2>What's in the box</h2>
      <ul>
        <li><strong>Routing &amp; data</strong> — file-based routes, nested layouts, middleware, server loaders, form actions, API routes, streaming SSR.</li>
        <li><strong>Server functions</strong> — <code>"use server"</code> modules become typed RPC endpoints; the client gets a tiny fetch proxy.</li>
        <li><strong>Jetstream islands</strong> — server-reactive islands that update over a WebSocket with <em>zero</em> component JS on the client.</li>
        <li><strong>Plugins</strong> — <code>transform</code> hooks and virtual modules (<code>resolveId</code> / <code>load</code>); a <code>.tsrx</code> bridge.</li>
        <li><strong>Deploy anywhere</strong> — Node, Bun, Deno, static prerender, or Cloudflare Workers via build adapters.</li>
      </ul>

      <div class="note">
        Nowaki is <strong>alpha</strong>. The API may still change between minor versions. It's real
        and published on npm and crates.io, but not yet recommended for production.
      </div>

      <div class="pager">
        <span />
        <a href="/docs/quickstart">Quickstart →</a>
      </div>
    </>
  );
}
