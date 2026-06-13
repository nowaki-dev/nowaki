export const lang = "en";
export const title = "Nowaki docs — Jetstream islands";

export default function Jetstream() {
  return (
    <>
      <h1>Jetstream islands <span class="badge">v0.6</span></h1>
      <p class="lead">
        Server-reactive islands. State lives on the server; interactions go over a WebSocket and the
        server pushes an HTML patch — with <strong>zero component JavaScript</strong> on the client.
      </p>

      <p>
        A regular island ships its component JS and runs in the browser. A Jetstream island ships
        none: the server holds its state per connection, re-renders on events, and sends a DOM patch
        that a ~2&nbsp;KB runtime morphs in. It's Nowaki's answer to "content-driven but dynamic"
        UIs — live counters, dashboards, presence — without shipping a client framework.
      </p>

      <h2>Write one</h2>
      <p>
        Give an island an <code>export const live</code> with initial <code>state</code> and
        <code>on</code> handlers. Buttons reference handlers with <code>data-live</code> — no
        <code>onClick</code>, no client component.
      </p>
      <pre><code>{`// islands/LiveCounter.tsx
export const live = {
  state: () => ({ count: 0 }),
  on: {
    inc: (s) => ({ ...s, count: s.count + 1 }),
    dec: (s) => ({ ...s, count: s.count - 1 }),
    reset: () => ({ count: 0 }),
  },
};

export default function LiveCounter({ state }) {
  return (
    <div>
      <button data-live="dec">-</button>
      <strong>live: {state.count}</strong>
      <button data-live="inc">+</button>
    </div>
  );
}`}</code></pre>

      <h2>How it works</h2>
      <ul>
        <li>The build emits <strong>no client chunk</strong> for live islands; it SSRs them inside a <code>&lt;nowaki-live&gt;</code> wrapper with the initial state.</li>
        <li>The Rust front holds a <code>/__nowaki/live</code> WebSocket and keeps each island's state per connection.</li>
        <li>A <code>data-live</code> event is bridged to the Node renderer (a pure <code>state → html</code> function); the new HTML is pushed as a patch and morphed into the DOM.</li>
        <li>Client and optimistic islands coexist on the same page.</li>
      </ul>

      <h2>Presence &amp; scaling <span class="badge">v0.9</span></h2>
      <ul>
        <li><strong>Presence</strong> — the server broadcasts the live connection count; clients receive <code>{`{ type: "presence", count }`}</code> and it's mirrored into <code>[data-nowaki-presence]</code> elements (and a <code>nowaki:presence</code> event).</li>
        <li><strong>Heartbeat</strong> — connections ping periodically and idle ones are dropped, so zombie connections don't leak state.</li>
        <li><strong>Connection cap</strong> — a global limit (<code>NOWAKI_LIVE_MAX</code>); over it, the client keeps the initial SSR view (graceful degradation).</li>
      </ul>

      <div class="note">
        Static and edge deploys serve the initial SSR and degrade gracefully without a WebSocket;
        the connected, reactive mode runs under <code>nowaki start</code> (the Rust front holds the
        socket). Validate inputs in your <code>on</code> handlers as you would any server handler.
      </div>

      <div class="pager">
        <a href="/docs/server-functions">← Server functions</a>
        <a href="/docs/plugins">Plugins &amp; virtual modules →</a>
      </div>
    </>
  );
}
