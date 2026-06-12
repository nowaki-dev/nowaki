import WindHero from "../islands/WindHero.tsx";
import CopyCommand from "../islands/CopyCommand.tsx";
import { STRINGS, GH, CRATES, NPM } from "../lib/i18n.ts";
import type { Locale } from "../lib/i18n.ts";

export default function Landing({ locale }: { locale: Locale }) {
  const s = STRINGS[locale];
  const home = locale === "ja" ? "/ja" : "/";

  const codeHtml = `<span class="c">${s.code.commentTop}</span>
<span class="k">import</span> Counter <span class="k">from</span> <span class="s">"../islands/Counter.tsx"</span>;

<span class="k">export const</span> <span class="f">loader</span> = <span class="k">async</span> () =&gt; {
  <span class="k">return</span> { message: <span class="s">"${s.code.serverMsg}"</span> };
};

<span class="k">export default function</span> <span class="f">Home</span>({ data }) {
  <span class="k">return</span> (
    &lt;<span class="f">main</span>&gt;
      &lt;<span class="f">h1</span>&gt;{data.message}&lt;/<span class="f">h1</span>&gt;
      &lt;<span class="f">Counter</span> <span class="a">start</span>={<span class="s">5</span>} /&gt;  <span class="c">${s.code.commentInline}</span>
    &lt;/<span class="f">main</span>&gt;
  );
}`;

  return (
    <>
      <header class="storm">
        <WindHero />
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
            <a class="on-storm-muted hover:text-onstorm" href={`${GH}#readme`}>
              {s.nav.docs}
            </a>
            <a class="on-storm-muted hover:text-onstorm" href={GH}>
              GitHub ↗
            </a>
          </div>
        </nav>

        <div class="wrap z1" style="padding-block:clamp(3.5rem,2rem + 7vw,7rem)">
          <span class="eyetag" style="border:1px solid oklch(0.78 0.1 256 / 0.4);color:var(--cyan)">
            {s.hero.badge}
          </span>
          <h1 class="hero-title" style="margin-top:1.4rem;max-width:20ch">
            <span style="display:block">{s.hero.h1a}</span>
            <span class="mark" style="display:block">{s.hero.h1b}</span>
          </h1>
          <p class="lead" style="margin-top:1.5rem;max-width:54ch;color:var(--on-storm);font-weight:450">
            {s.hero.sub}
          </p>

          <div style="margin-top:2.2rem;max-width:30rem;display:flex;flex-direction:column;gap:.7rem">
            <CopyCommand cmd="npm create nowaki my-app" primary labelCopy={s.copy.copy} labelCopied={s.copy.copied} />
            <div style="display:flex;gap:.7rem;flex-wrap:wrap">
              <div style="flex:1;min-width:14rem">
                <CopyCommand cmd="cargo install nowaki" labelCopy={s.copy.copy} labelCopied={s.copy.copied} />
              </div>
            </div>
          </div>

          <p style="margin-top:1.4rem;font-size:.92rem;color:var(--on-storm);font-weight:500">
            {s.hero.alpha}
          </p>
        </div>
      </header>

      <main>
        {/* Speed */}
        <section class="section wrap">
          <h2 class="h-sec" style="max-width:18ch">{s.speed.h2}</h2>
          <p class="lead measure" style="margin-top:1.1rem">{s.speed.lead}</p>
          <div style="margin-top:2.8rem;display:grid;gap:2.2rem;grid-template-columns:1fr" class="sm:grid-cols-3">
            {s.speed.stats.map((st) => (
              <div>
                <div style="font-size:clamp(2.1rem,1.4rem + 2.6vw,3.3rem);font-weight:800;letter-spacing:-0.03em;color:var(--primary-strong);line-height:1">
                  {st.value}
                </div>
                <p style="margin-top:.6rem;color:var(--muted);max-width:26ch">{st.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section style="background:var(--surface);border-block:1px solid var(--line)">
          <div class="section wrap">
            <h2 class="h-sec" style="max-width:16ch">{s.how.h2}</h2>
            <div style="margin-top:2.6rem;display:grid;gap:2.2rem;grid-template-columns:1fr" class="md:grid-cols-3">
              {s.how.steps.map((step) => (
                <div>
                  <code style="display:inline-block;font-size:.82rem;padding:.4rem .65rem;border-radius:.5rem;background:var(--bg);border:1px solid var(--line);color:var(--primary-strong)">
                    {step.cmd}
                  </code>
                  <h3 style="margin-top:.95rem;font-size:1.2rem;letter-spacing:-0.02em">{step.title}</h3>
                  <p
                    style="margin-top:.5rem;color:var(--muted);max-width:46ch"
                    dangerouslySetInnerHTML={{ __html: step.body }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Code example */}
        <section class="section wrap">
          <div style="display:grid;gap:clamp(1.5rem,4vw,3rem);grid-template-columns:1fr" class="md:grid-cols-[0.85fr_1.15fr] md:items-center">
            <div>
              <h2 class="h-sec">{s.code.h2}</h2>
              <p
                class="lead measure"
                style="margin-top:1.1rem"
                dangerouslySetInnerHTML={{ __html: s.code.lead }}
              />
            </div>
            <pre class="code" aria-label="Example Nowaki route">
              <code dangerouslySetInnerHTML={{ __html: codeHtml }} />
            </pre>
          </div>
        </section>

        {/* Features */}
        <section style="background:var(--surface);border-block:1px solid var(--line)">
          <div class="section wrap">
            <h2 class="h-sec" style="max-width:16ch">{s.features.h2}</h2>
            <p class="lead measure" style="margin-top:1.1rem">{s.features.lead}</p>
            <div style="margin-top:2rem;display:grid;grid-template-columns:1fr;column-gap:3rem" class="md:grid-cols-2">
              {s.features.items.map((f) => (
                <div style="border-top:1px solid var(--line)">
                  <div style="padding-block:1.5rem">
                    <h3 style="font-size:1.15rem;letter-spacing:-0.02em">{f.title}</h3>
                    <p
                      style="margin-top:.5rem;color:var(--muted);max-width:52ch"
                      dangerouslySetInnerHTML={{ __html: f.body }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Honest alpha */}
        <section class="section wrap">
          <h2 class="h-sec">{s.alpha.h2}</h2>
          <p class="lead measure" style="margin-top:1.1rem">{s.alpha.lead}</p>
          <div style="margin-top:2rem;display:grid;gap:2rem;grid-template-columns:1fr" class="md:grid-cols-2">
            <div>
              <h3 style="font-size:1rem;font-family:'JetBrains Mono',monospace;letter-spacing:.02em">
                {s.alpha.worksTitle}
              </h3>
              <ul style="margin-top:.9rem;list-style:none;padding:0;display:flex;flex-direction:column;gap:.55rem">
                {s.alpha.works.map((w) => (
                  <li style="display:flex;gap:.7rem;align-items:baseline">
                    <span aria-hidden="true" style="color:var(--primary)">→</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style="font-size:1rem;font-family:'JetBrains Mono',monospace;letter-spacing:.02em;color:var(--muted)">
                {s.alpha.soonTitle}
              </h3>
              <ul style="margin-top:.9rem;list-style:none;padding:0;display:flex;flex-direction:column;gap:.55rem;color:var(--muted)">
                {s.alpha.soon.map((x) => (
                  <li style="display:flex;gap:.7rem;align-items:baseline">
                    <span aria-hidden="true">○</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p style="margin-top:2rem">
            <a class="link-u" href={`${GH}/blob/main/ROADMAP.md`}>{s.alpha.roadmap}</a>
          </p>
        </section>
      </main>

      <footer class="storm" style="background:var(--storm)">
        <div class="wrap z1 section" style="padding-block:clamp(3rem,4vw,4.5rem)">
          <div style="display:flex;flex-wrap:wrap;gap:2rem;justify-content:space-between;align-items:flex-start">
            <div style="max-width:32ch">
              <div style="display:flex;align-items:baseline;gap:.5rem">
                <span style="font-weight:800;font-size:1.25rem;letter-spacing:-0.03em">Nowaki</span>
                <span class="on-storm-muted" style="font-size:.8rem">野分</span>
              </div>
              <p class="on-storm-muted" style="margin-top:.7rem;font-size:.92rem;color:var(--on-storm-muted)">
                {s.footer.tagline}
              </p>
            </div>
            <nav aria-label="Footer" style="display:flex;gap:2.5rem;font-size:.92rem;flex-wrap:wrap">
              <div style="display:flex;flex-direction:column;gap:.6rem">
                <a class="on-storm-muted hover:text-onstorm" href={GH}>GitHub ↗</a>
                <a class="on-storm-muted hover:text-onstorm" href={CRATES}>crates.io ↗</a>
                <a class="on-storm-muted hover:text-onstorm" href={NPM}>npm ↗</a>
              </div>
            </nav>
          </div>
          <hr style="height:1px;border:0;background:oklch(1 0 0 / 0.1);margin-block:2rem" />
          <div class="on-storm-muted" style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:space-between;font-size:.82rem;color:var(--on-storm-muted)">
            <span>{s.footer.copyright}</span>
            <span>{s.footer.windName}</span>
          </div>
          <p class="on-storm-muted" style="margin-top:1.1rem;font-size:.76rem;color:var(--on-storm-muted);max-width:64ch">
            {s.footer.trademark}
          </p>
        </div>
      </footer>
    </>
  );
}
