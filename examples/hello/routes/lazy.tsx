// 遅延ハイドレーション（Astro 互換の client:* 指令）のデモ。
// それぞれの島が異なる戦略でハイドレートする。client:visible はスクロールで可視になるまで、
// client:idle はアイドル時、client:only は SSR せずクライアントだけで描画。
import Counter from "../islands/Counter.tsx";
import ClientOnly from "../islands/ClientOnly.tsx";

export const title = "Lazy hydration — Nowaki";

export default function Lazy() {
  return (
    <main style="font-family:system-ui,sans-serif;max-width:640px;margin:2rem auto;padding:0 1.25rem">
      <h1>Lazy hydration</h1>

      <section data-testid="sec-load">
        <h2>client:load（既定・即時）</h2>
        <Counter start={0} />
      </section>

      <section data-testid="sec-idle">
        <h2>client:idle</h2>
        <Counter start={10} client:idle />
      </section>

      <section data-testid="sec-only">
        <h2>client:only（SSR なし）</h2>
        <ClientOnly client:only />
      </section>

      {/* 下のカウンタを折り返しの下へ押しやる（可視になるまでハイドレートしない） */}
      <div style="height:150vh" aria-hidden="true" />

      <section data-testid="sec-visible">
        <h2>client:visible</h2>
        <Counter start={100} client:visible />
      </section>
    </main>
  );
}
