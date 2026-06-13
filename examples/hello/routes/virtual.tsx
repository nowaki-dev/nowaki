import VirtualBadge from "../islands/VirtualBadge.tsx";

export const title = "Virtual modules — Nowaki";

export default function Page() {
  return (
    <main style="font-family:sans-serif;max-width:640px;margin:4rem auto">
      <h1>Virtual modules</h1>
      <p>
        プラグインの <code>resolveId</code> / <code>load</code> でディスクに無いモジュール
        （<code>virtual:build-info</code>）を生成し、島が import しています。
      </p>
      <VirtualBadge />
      <p style="margin-top:2rem">
        <a href="/">← home</a>
      </p>
    </main>
  );
}
