export const lang = "en";
export const title = "Nowaki docs — Server functions";

export default function ServerFunctions() {
  return (
    <>
      <h1>Server functions <span class="badge">v0.8</span></h1>
      <p class="lead">
        A module with a top-of-file <code>"use server"</code> directive becomes an RPC boundary. Its
        exports run only on the server; the browser gets a tiny <code>fetch</code> proxy.
      </p>

      <h2>Write one</h2>
      <pre><code>{`// actions/todos.ts
"use server";

import { getContext } from "@nowaki-dev/runtime/server/functions.mjs";

const store: string[] = [];

export async function addTodo(text: string) {
  store.push(text.trim());
  return store.slice();
}

export async function whoami() {
  const ctx = getContext();              // request context, RPC-time only
  return ctx?.cookies?.user ?? "anonymous";
}`}</code></pre>
      <p>
        <code>getContext</code> and the framework types come from
        <code>@nowaki-dev/runtime</code>:
      </p>
      <pre><code>{`import { getContext } from "@nowaki-dev/runtime";
import type { LoaderContext, PageProps, Meta } from "@nowaki-dev/runtime";`}</code></pre>

      <h2>Call it from an island</h2>
      <p>Import and call it like a normal async function. The browser only ships the proxy.</p>
      <pre><code>{`// islands/Todos.tsx
import { useState } from "preact/hooks";
import { addTodo } from "../actions/todos.ts";

export default function Todos({ initial = [] }) {
  const [todos, setTodos] = useState(initial);
  return <button onClick={async () => setTodos(await addTodo("new"))}>add</button>;
}`}</code></pre>
      <p>
        On the server you can call the same function directly (no HTTP) — e.g. from a route
        <code>loader</code> — so server-to-server calls stay in-process.
      </p>

      <h2>How it works</h2>
      <ul>
        <li>The build strips the implementation (and its server-only imports) from the client bundle and emits a proxy that posts <code>{`{ id, args }`}</code> to <code>/__nowaki/fn</code>.</li>
        <li>Each export gets a stable id (a hash of <code>module#export</code>) computed identically on both sides.</li>
        <li>Dispatch is <strong>allowlisted</strong>: the server maps id → {`{ module, export }`} from a build-time table. A client can't reach an arbitrary export.</li>
        <li><code>getContext()</code> exposes the request context (cookies, headers) via AsyncLocalStorage during the call.</li>
        <li>Works in dev, <code>nowaki start</code>, and on edge adapters.</li>
      </ul>

      <div class="note">
        Treat each server function like a public HTTP endpoint: <strong>validate its arguments</strong>
        (they arrive as JSON from the client) and check authorization with <code>getContext()</code>.
        Errors return only <code>error.message</code> to the client, never the stack.
      </div>

      <h2>Authoring rules</h2>
      <ul>
        <li>Server modules live under <code>routes/</code>, <code>islands/</code>, <code>components/</code>, <code>lib/</code>, or <code>actions/</code>.</li>
        <li>Use explicit file extensions in imports (<code>../actions/todos.ts</code>).</li>
        <li>Exports should be async functions that take JSON-serializable arguments and return JSON-serializable values.</li>
      </ul>

      <div class="pager">
        <a href="/docs/routing">← Routing &amp; data</a>
        <a href="/docs/jetstream">Jetstream islands →</a>
      </div>
    </>
  );
}
