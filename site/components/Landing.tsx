import WindHero from "../islands/WindHero.tsx";
import CopyCommand from "../islands/CopyCommand.tsx";
import Animator from "../islands/Animator.tsx";
import { STRINGS, GH, CRATES, NPM } from "../lib/i18n.ts";
import type { Locale } from "../lib/i18n.ts";

export default function Landing({ locale }: { locale: Locale }) {
  const s = STRINGS[locale];
  const home = locale === "ja" ? "/ja" : "/";

  // 風のマーキーに流すキーワード（両ロケール共通の技術用語）
  const winds = [
    "Rust toolchain", "oxc", "islands", "zero JS by default", "server loaders",
    "actions", "middleware", "API routes", "scope-hoisted", "SSR", "npm install", "source maps",
  ];

  // ルート + loader + 島
  const routeHtml = `<span class="c">// routes/blog/[slug].tsx</span>
<span class="k">import</span> Comments <span class="k">from</span> <span class="s">"../../islands/Comments.tsx"</span>;

<span class="c">// runs on the server only</span>
<span class="k">export const</span> <span class="f">loader</span> = <span class="k">async</span> ({ params }) =&gt; ({
  post: <span class="k">await</span> db.<span class="f">post</span>(params.slug),
});

<span class="k">export default function</span> <span class="f">Post</span>({ data }) {
  <span class="k">return</span> (
    &lt;<span class="f">article</span>&gt;
      &lt;<span class="f">h1</span>&gt;{data.post.title}&lt;/<span class="f">h1</span>&gt;
      &lt;<span class="f">Comments</span> <span class="a">postId</span>={data.post.id} /&gt; <span class="c">// only this hydrates</span>
    &lt;/<span class="f">article</span>&gt;
  );
}`;

  // action 付きフォーム
  const actionHtml = `<span class="c">// routes/guestbook.tsx</span>
<span class="k">export const</span> <span class="f">loader</span> = (ctx) =&gt; ({ entries: <span class="f">read</span>(ctx) });

<span class="c">// a non-GET request runs the action</span>
<span class="k">export async function</span> <span class="f">action</span>(ctx) {
  <span class="k">const</span> form = <span class="k">await</span> ctx.<span class="f">formData</span>();
  ctx.<span class="f">setCookie</span>(<span class="s">"guestbook"</span>, <span class="f">add</span>(form.<span class="f">get</span>(<span class="s">"msg"</span>)));
  <span class="k">return</span> ctx.<span class="f">redirect</span>(<span class="s">"/guestbook"</span>); <span class="c">// PRG</span>
}`;

  return (
    <>
      <div class="progressbar" data-progress aria-hidden="true" />
      <Animator />

      <header class="storm" data-hero>
        <WindHero />
        <div class="watermark" data-parallax="0.18" aria-hidden="true">野分</div>
        <div class="storm__scrim" aria-hidden="true" />

        <nav class="wrap z1 flex items-center justify-between py-5" style="gap:1rem;flex-wrap:wrap">
          <a href={home} class="flex items-baseline gap-2">
            <span style="font-weight:800;font-size:1.25rem;letter-spacing:-0.03em">Nowaki</span>
            <span class="on-storm-muted" style="font-size:.8rem">野分</span>
          </a>
          <div class="flex items-center gap-5" style="font-size:.92rem;flex-wrap:wrap">
            <span class="lang flex items-center gap-2">
              <a href="/" aria-current={locale === "en" ? "true" : undefined}>EN</a>
              <span class="on-storm-muted" aria-hidden="true">·</span>
              <a href="/ja" aria-current={locale === "ja" ? "true" : undefined}>日本語</a>
            </span>
            <a class="on-storm-muted hover:text-onstorm" href="/docs">{s.nav.docs}</a>
            <a class="on-storm-muted hover:text-onstorm" href={GH}>GitHub ↗</a>
          </div>
        </nav>

        <div class="wrap z1" style="padding-block:clamp(3.5rem,2rem + 7vw,7.5rem);max-width:60rem">
          <span class="eyetag" data-reveal style="border:1px solid oklch(0.78 0.1 256 / 0.4);color:var(--cyan)">
            {s.hero.badge}
          </span>
          <h1 class="hero-title" data-hero-title style="margin-top:1.5rem;max-width:18ch">
            <span style="display:block">{s.hero.h1a}</span>
            <span class="mark" style="display:block">{s.hero.h1b}</span>
          </h1>
          <p class="lead" data-reveal style="margin-top:1.6rem;max-width:54ch;color:var(--on-storm);font-weight:450">
            {s.hero.sub}
          </p>

          <div data-reveal style="margin-top:2.3rem;max-width:30rem;display:flex;flex-direction:column;gap:.7rem">
            <CopyCommand cmd="npm create nowaki@latest my-app" primary labelCopy={s.copy.copy} labelCopied={s.copy.copied} />
            <CopyCommand cmd="npm i -g nowaki" labelCopy={s.copy.copy} labelCopied={s.copy.copied} />
          </div>

          <p data-reveal style="margin-top:1.3rem;max-width:46ch;font-size:.95rem;color:var(--cyan);font-weight:500">
            {s.hero.rustfree}
          </p>
          <p data-reveal style="margin-top:.7rem;font-size:.9rem;color:var(--on-storm-muted)">
            {s.hero.alpha}
          </p>
        </div>
      </header>

      <div class="marquee" aria-hidden="true">
        <div class="marquee__track" data-marquee>
          {[0, 1].map((k) => (
            <div class="marquee__item" key={k}>
              {winds.flatMap((w, i) => [
                <b key={`w${i}`}>{w}</b>,
                <span class="marquee__dot" key={`d${i}`}>◆</span>,
              ])}
            </div>
          ))}
        </div>
      </div>

      <main>
        {/* Ship: the honest benchmark */}
        <section class="section wrap">
          <p class="kicker" data-rise>Show, don't claim</p>
          <h2 class="h-sec" data-rise style="margin-top:.8rem;max-width:20ch">{s.ship.h2}</h2>
          <p class="lead measure" data-rise style="margin-top:1.1rem">{s.ship.lead}</p>
          <div style="margin-top:2.6rem;max-width:48rem">
            {s.ship.bars.map((bar) => (
              <div class="bar-row">
                <div class="bar-top">
                  <span class="bar-label">{bar.label}</span>
                  <span class="bar-val" data-countup style={bar.muted ? "color:var(--muted)" : "color:var(--primary-strong)"}>
                    {bar.value}
                  </span>
                </div>
                <div class="bar-track">
                  <div
                    class={`bar-fill${bar.muted ? " bar-fill--muted" : bar.zero ? " bar-fill--accent" : ""}`}
                    style={`width:${bar.pct}%`}
                  />
                </div>
              </div>
            ))}
          </div>
          <p style="margin-top:1.5rem;font-size:.88rem;color:var(--muted);max-width:60ch">{s.ship.note}</p>
        </section>

        {/* Speed — 嵐バンド（前線） */}
        <section class="storm">
          <div class="section wrap z1">
            <h2 class="h-sec" data-rise style="max-width:18ch">{s.speed.h2}</h2>
            <p class="lead measure" data-rise style="margin-top:1.1rem;color:var(--on-storm-muted)">{s.speed.lead}</p>
            <div style="margin-top:3rem;display:grid;gap:2.4rem" class="grid-cols-1 sm:grid-cols-3" data-rise-group>
              {s.speed.stats.map((st, i) => (
                <div>
                  <div
                    {...(i === 0 ? { "data-countup": true } : {})}
                    style="font-size:clamp(1.8rem,1.2rem + 2.2vw,2.8rem);font-weight:800;letter-spacing:-0.04em;color:var(--cyan);line-height:1.04"
                  >
                    {st.value}
                  </div>
                  <p style="margin-top:.7rem;color:var(--on-storm-muted);max-width:28ch">{st.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works — 本物の3ステップ（順次表示） */}
        <section class="section wrap">
          <h2 class="h-sec" data-rise style="max-width:18ch">{s.how.h2}</h2>
          <div style="margin-top:2.8rem;display:grid;gap:2.4rem" class="grid-cols-1 md:grid-cols-3" data-steps>
            {s.how.steps.map((step) => (
              <div>
                <code style="display:inline-block;font-size:.82rem;padding:.4rem .65rem;border-radius:.5rem;background:var(--surface);border:1px solid var(--line);color:var(--primary-strong)">
                  {step.cmd}
                </code>
                <h3 style="margin-top:.95rem;font-size:1.25rem;letter-spacing:-0.025em">{step.title}</h3>
                <p
                  style="margin-top:.5rem;color:var(--muted);max-width:46ch"
                  dangerouslySetInnerHTML={{ __html: step.body }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Code showcase */}
        <section style="background:var(--surface);border-block:1px solid var(--line)">
          <div class="section wrap">
            <h2 class="h-sec" data-rise style="max-width:20ch">{s.code.h2}</h2>
            <p class="lead measure" data-rise style="margin-top:1.1rem" dangerouslySetInnerHTML={{ __html: s.code.lead }} />
            <div style="margin-top:2.4rem;display:grid;gap:1.5rem" class="grid-cols-1 md:grid-cols-2" data-rise-group>
              <div>
                <p class="kicker" style="color:var(--muted)">{s.code.tabs[0]}</p>
                <pre class="code" style="margin-top:.7rem" aria-label="A route with a loader">
                  <code dangerouslySetInnerHTML={{ __html: routeHtml }} />
                </pre>
              </div>
              <div>
                <p class="kicker" style="color:var(--muted)">{s.code.tabs[1]}</p>
                <pre class="code" style="margin-top:.7rem" aria-label="A form with an action">
                  <code dangerouslySetInnerHTML={{ __html: actionHtml }} />
                </pre>
              </div>
            </div>
            <p class="kicker" style="color:var(--muted);margin-top:2.6rem">{s.code.tabs[2]}</p>
            <div style="margin-top:1rem;display:grid;gap:.1rem" class="grid-cols-1 sm:grid-cols-2">
              {s.code.conventions.map((c) => (
                <div style="display:flex;gap:1rem;align-items:baseline;padding:.75rem .2rem;border-top:1px solid var(--line)">
                  <code style="color:var(--primary-strong);font-size:.85rem;white-space:nowrap">{c.f}</code>
                  <span style="color:var(--muted);font-size:.9rem">{c.d}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Compare */}
        <section class="section wrap">
          <h2 class="h-sec" data-rise style="max-width:20ch">{s.compare.h2}</h2>
          <p class="lead measure" data-rise style="margin-top:1.1rem">{s.compare.lead}</p>
          <div class="ctable-scroll" data-rise>
            <table class="ctable">
              <colgroup>
                <col />
                <col class="col-nowaki" />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">.</th>
                  {s.compare.cols.map((c, i) => (
                    <th scope="col" class={i === 0 ? "is-nowaki" : undefined}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.compare.rows.map((r) => (
                  <tr class={r.highlight ? "is-jet" : undefined}>
                    <th scope="row">
                      {r.feature}
                      {r.highlight ? <span class="jet-tag">Only Nowaki</span> : null}
                    </th>
                    <td class="is-nowaki">{r.nowaki}</td>
                    <td>{r.next}</td>
                    <td>{r.astro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="jet-only" data-rise dangerouslySetInnerHTML={{ __html: s.compare.only }} />
          <p style="margin-top:1.4rem;font-size:.88rem;color:var(--muted);max-width:64ch">{s.compare.note}</p>
        </section>

        {/* Positioning */}
        <section style="background:var(--surface);border-block:1px solid var(--line)">
          <div class="section wrap">
            <h2 class="h-sec" data-rise style="max-width:16ch">{s.positioning.h2}</h2>
            <p class="lead measure" data-rise style="margin-top:1.1rem">{s.positioning.lead}</p>
            <div style="margin-top:2.6rem;display:grid;gap:2.6rem" class="grid-cols-1 md:grid-cols-2" data-rise-group>
              <div class="pcol">
                <h3 style="color:var(--primary-strong)">{s.positioning.forTitle}</h3>
                <ul>
                  {s.positioning.for.map((x) => (
                    <li><span aria-hidden="true" style="color:var(--primary)">→</span><span>{x}</span></li>
                  ))}
                </ul>
              </div>
              <div class="pcol">
                <h3 style="color:var(--muted)">{s.positioning.notTitle}</h3>
                <ul>
                  {s.positioning.not.map((x) => (
                    <li><span aria-hidden="true">○</span><span>{x}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section class="section wrap">
          <h2 class="h-sec" data-rise style="max-width:18ch">{s.features.h2}</h2>
          <p class="lead measure" data-rise style="margin-top:1.1rem">{s.features.lead}</p>
          <div style="margin-top:2.2rem;display:grid;column-gap:3rem" class="grid-cols-1 md:grid-cols-2" data-rise-group>
            {s.features.items.map((f) => (
              <div style="border-top:1px solid var(--line)">
                <div style="padding-block:1.5rem">
                  <h3 style="font-size:1.15rem;letter-spacing:-0.025em">{f.title}</h3>
                  <p
                    style="margin-top:.5rem;color:var(--muted);max-width:52ch"
                    dangerouslySetInnerHTML={{ __html: f.body }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Honest alpha */}
        <section style="background:var(--surface);border-block:1px solid var(--line)">
          <div class="section wrap">
            <h2 class="h-sec" data-rise>{s.alpha.h2}</h2>
            <p class="lead measure" data-rise style="margin-top:1.1rem">{s.alpha.lead}</p>
            <div style="margin-top:2.2rem;display:grid;gap:2.2rem" class="grid-cols-1 md:grid-cols-2" data-rise-group>
              <div>
                <h3 style="font-size:1rem;font-family:'JetBrains Mono',monospace;letter-spacing:.02em">{s.alpha.worksTitle}</h3>
                <ul style="margin-top:.9rem;list-style:none;padding:0;display:flex;flex-direction:column;gap:.55rem">
                  {s.alpha.works.map((w) => (
                    <li style="display:flex;gap:.7rem;align-items:baseline">
                      <span aria-hidden="true" style="color:var(--primary)">→</span><span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 style="font-size:1rem;font-family:'JetBrains Mono',monospace;letter-spacing:.02em;color:var(--muted)">{s.alpha.soonTitle}</h3>
                <ul style="margin-top:.9rem;list-style:none;padding:0;display:flex;flex-direction:column;gap:.55rem;color:var(--muted)">
                  {s.alpha.soon.map((x) => (
                    <li style="display:flex;gap:.7rem;align-items:baseline">
                      <span aria-hidden="true">○</span><span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p style="margin-top:2rem">
              <a class="link-u" href={`${GH}/blob/main/ROADMAP.md`}>{s.alpha.roadmap}</a>
            </p>
          </div>
        </section>
      </main>

      <footer class="storm" style="background:var(--storm)">
        <div class="wrap z1 section" style="padding-block:clamp(3rem,4vw,4.5rem)">
          <div style="display:flex;flex-wrap:wrap;gap:2rem;justify-content:space-between;align-items:flex-start">
            <div style="max-width:34ch">
              <div style="display:flex;align-items:baseline;gap:.5rem">
                <span style="font-weight:800;font-size:1.25rem;letter-spacing:-0.03em">Nowaki</span>
                <span class="on-storm-muted" style="font-size:.8rem">野分</span>
              </div>
              <p class="on-storm-muted" style="margin-top:.7rem;font-size:.92rem;color:var(--on-storm-muted)">{s.footer.tagline}</p>
            </div>
            <nav aria-label="Footer" style="display:flex;gap:2.5rem;font-size:.92rem;flex-wrap:wrap">
              <div style="display:flex;flex-direction:column;gap:.6rem">
                <a class="on-storm-muted hover:text-onstorm" href={GH}>GitHub ↗</a>
                <a class="on-storm-muted hover:text-onstorm" href={NPM}>npm ↗</a>
                <a class="on-storm-muted hover:text-onstorm" href={CRATES}>crates.io ↗</a>
              </div>
            </nav>
          </div>
          <hr style="height:1px;border:0;background:oklch(1 0 0 / 0.1);margin-block:2rem" />
          <div class="on-storm-muted" style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:space-between;font-size:.82rem;color:var(--on-storm-muted)">
            <span>{s.footer.copyright}</span>
            <span>{s.footer.windName}</span>
          </div>
          <p class="on-storm-muted" style="margin-top:1.1rem;font-size:.76rem;color:var(--on-storm-muted);max-width:64ch">{s.footer.trademark}</p>
        </div>
      </footer>
    </>
  );
}
