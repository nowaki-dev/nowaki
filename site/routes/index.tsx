import WindHero from "../islands/WindHero.tsx";
import CopyCommand from "../islands/CopyCommand.tsx";

export const title =
  "Nowaki: a full-stack web framework with Rust-grade speed";

const DESC =
  "Nowaki (野分) is a full-stack web framework with routing, server loaders, SSR and API routes, on a Rust toolchain. Dev server ready in ~90ms, millisecond rebuilds. Full-stack like Next.js, fast like Rust.";

export const head = `
<meta name="description" content="${DESC}" />
<meta name="theme-color" content="#0b1220" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Nowaki: full-stack like Next.js, fast like Rust" />
<meta property="og:description" content="${DESC}" />
<meta property="og:url" content="https://nowaki.dev" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          bg: "var(--bg)", surface: "var(--surface)", ink: "var(--ink)",
          muted: "var(--muted)", primary: "var(--primary)", accent: "var(--accent)",
          storm: "var(--storm)", line: "var(--line)", onstorm: "var(--on-storm)"
        },
        fontFamily: {
          display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
          mono: ['"JetBrains Mono"', "ui-monospace", "monospace"]
        }
      }
    }
  };
</script>
<style>
  :root{
    --bg: oklch(1 0 0);
    --surface: oklch(0.976 0.006 255);
    --ink: oklch(0.205 0.014 258);
    --muted: oklch(0.435 0.022 258);
    --primary: oklch(0.50 0.155 256);
    --primary-strong: oklch(0.435 0.16 256);
    --accent: oklch(0.64 0.19 42);
    --storm: oklch(0.155 0.032 263);
    --storm-2: oklch(0.215 0.044 265);
    --on-storm: oklch(0.965 0.012 256);
    --on-storm-muted: oklch(0.91 0.022 256);
    --line: oklch(0.905 0.01 258);
    --cyan: #9fd4ff;
    --ease: cubic-bezier(0.16,1,0.3,1);
  }
  *{ box-sizing:border-box }
  html{ -webkit-text-size-adjust:100%; scroll-behavior:smooth }
  body{
    margin:0; background:var(--bg); color:var(--ink);
    font-family:"Bricolage Grotesque", system-ui, sans-serif;
    font-optical-sizing:auto; -webkit-font-smoothing:antialiased;
    font-size:1.0625rem; line-height:1.62;
  }
  h1,h2,h3{ font-weight:800; letter-spacing:-0.032em; line-height:1.06; text-wrap:balance; margin:0 }
  p{ text-wrap:pretty; margin:0 }
  a{ color:inherit; text-decoration:none }
  code,kbd,pre{ font-family:"JetBrains Mono", ui-monospace, monospace }
  ::selection{ background: oklch(0.50 0.155 256 / 0.20) }
  :focus-visible{ outline:2px solid var(--primary); outline-offset:2px; border-radius:3px }

  .wrap{ width:100%; max-width:1080px; margin-inline:auto; padding-inline:clamp(1.25rem,4vw,2rem) }
  .section{ padding-block:clamp(4.5rem,3rem + 6vw,8rem) }
  .measure{ max-width:60ch }
  .lead{ font-size:clamp(1.08rem,1rem + .55vw,1.32rem); line-height:1.55; color:var(--muted) }
  .h-sec{ font-size:clamp(1.85rem,1.2rem + 2.4vw,2.95rem); letter-spacing:-0.03em }
  .eyetag{ display:inline-flex; align-items:center; gap:.5rem; font-family:"JetBrains Mono",monospace;
    font-size:.74rem; letter-spacing:.06em; padding:.35rem .6rem; border-radius:99px; }

  /* storm hero band */
  .storm{ background:
    radial-gradient(70% 80% at 92% -25%, var(--storm-2), transparent 50%),
    var(--storm);
    color:var(--on-storm); position:relative; overflow:hidden; isolation:isolate;
  }
  .wind-canvas{ position:absolute; inset:0; width:100%; height:100%; z-index:0; pointer-events:none;
    /* keep streaks off the left text column; let them live on the right */
    mask-image: linear-gradient(90deg, transparent 0%, transparent 72%, #000 86%, #000 97%, transparent 100%);
  }
  /* テキスト列を確実に暗く保つ薄い暗幕。風（右）には掛けない。 */
  .storm__scrim{ position:absolute; inset:0; z-index:0; pointer-events:none;
    background:linear-gradient(90deg, rgba(11,16,26,0.82) 0%, rgba(11,16,26,0.6) 52%, transparent 76%); }
  .z1{ position:relative; z-index:1 }
  .hero-title{ font-size:clamp(2.7rem,1.55rem + 6.2vw,5.4rem); letter-spacing:-0.038em; line-height:1.0 }
  .mark{ color:var(--cyan) }
  .on-storm-muted{ color:var(--on-storm-muted) }

  /* command bar island */
  .copybar{ display:inline-flex; align-items:center; gap:.7rem; width:100%;
    padding:.9rem 1rem; border-radius:.7rem; border:1px solid oklch(0.72 0.05 256 / 0.28);
    background: oklch(1 0 0 / 0.05); color:var(--on-storm); font:inherit; cursor:pointer; text-align:left;
    transition:border-color .25s var(--ease), background .25s var(--ease), transform .25s var(--ease);
  }
  .copybar:hover{ border-color: oklch(0.78 0.1 256 / 0.55); background: oklch(1 0 0 / 0.09) }
  .copybar:active{ transform:translateY(1px) }
  .copybar:focus-visible{ outline:2px solid var(--cyan); outline-offset:2px }
  .copybar--primary{ background: oklch(1 0 0 / 0.10); border-color: oklch(0.8 0.12 256 / 0.6) }
  .copybar__prompt{ color:var(--cyan); font-family:"JetBrains Mono",monospace }
  .copybar__cmd{ flex:1; font-size:.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .copybar__state{ font-size:.7rem; letter-spacing:.09em; text-transform:uppercase; color:var(--on-storm-muted) }
  .copybar.on-light{ color:var(--ink); border-color:var(--line); background:var(--surface) }
  .copybar.on-light:hover{ border-color: oklch(0.55 0.1 256 / 0.5) }
  .copybar.on-light .copybar__prompt{ color:var(--primary) }
  .copybar.on-light .copybar__state{ color:var(--muted) }
  .copybar.on-light:focus-visible{ outline-color:var(--primary) }

  /* data bars */
  .bar-track{ height:.95rem; border-radius:99px; background:var(--surface); border:1px solid var(--line); overflow:hidden }
  .bar-fill{ height:100%; border-radius:99px }

  /* code */
  .code{ background:var(--storm); color:var(--on-storm); border-radius:.95rem; padding:1.35rem 1.5rem; overflow:auto;
    font-size:.86rem; line-height:1.75; margin:0; tab-size:2 }
  .code .k{ color:#c7adff } .code .s{ color:#9fe3b6 } .code .c{ color:oklch(0.68 0.02 256) }
  .code .f{ color:var(--cyan) } .code .a{ color:#ffc08a }

  .rule{ height:1px; background:var(--line); border:0; margin:0 }
  .link-u{ color:var(--primary-strong); text-decoration:underline; text-underline-offset:3px; text-decoration-thickness:1px }
  .link-u:hover{ text-decoration-thickness:2px }

  /* テキストは静的（常に可読）。ページのモーションは風 canvas が担う。 */
  .reveal{ }
  @media (prefers-reduced-motion: reduce){
    html{ scroll-behavior:auto }
    .reveal{ animation:none }
  }
</style>
`;

const GH = "https://github.com/nowaki-dev/nowaki";
const CRATES = "https://crates.io/crates/nowaki";
const NPM = "https://www.npmjs.com/package/create-nowaki";

const codeHtml = `<span class="c">// routes/index.tsx, runs on the server only</span>
<span class="k">import</span> Counter <span class="k">from</span> <span class="s">"../islands/Counter.tsx"</span>;

<span class="k">export const</span> <span class="f">loader</span> = <span class="k">async</span> () =&gt; {
  <span class="k">return</span> { message: <span class="s">"Hello from the server"</span> };
};

<span class="k">export default function</span> <span class="f">Home</span>({ data }) {
  <span class="k">return</span> (
    &lt;<span class="f">main</span>&gt;
      &lt;<span class="f">h1</span>&gt;{data.message}&lt;/<span class="f">h1</span>&gt;
      &lt;<span class="f">Counter</span> <span class="a">start</span>={<span class="s">5</span>} /&gt;  <span class="c">// only this hydrates</span>
    &lt;/<span class="f">main</span>&gt;
  );
}`;

function Nav() {
  return (
    <nav class="wrap z1 flex items-center justify-between py-5">
      <a href="/" class="flex items-baseline gap-2">
        <span style="font-weight:800;font-size:1.25rem;letter-spacing:-0.03em">Nowaki</span>
        <span class="on-storm-muted" style="font-size:.8rem">野分</span>
      </a>
      <div class="flex items-center gap-5" style="font-size:.92rem">
        <a class="on-storm-muted hover:text-onstorm" href={`${GH}#readme`}>Docs</a>
        <a class="on-storm-muted hover:text-onstorm" href={GH}>
          GitHub ↗
        </a>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header class="storm">
      <WindHero />
      <div class="storm__scrim" aria-hidden="true" />
      <Nav />
      <div class="wrap z1" style="padding-block:clamp(3.5rem,2rem + 7vw,7rem)">
        <span
          class="eyetag reveal"
          style="border:1px solid oklch(0.78 0.1 256 / 0.4);color:var(--cyan)"
        >
          v0.1 · alpha
        </span>
        <h1
          class="hero-title reveal"
          style="margin-top:1.4rem;max-width:16ch;animation-delay:.05s"
        >
          Full-stack like Next.js.{" "}
          <span class="mark">Fast like Rust.</span>
        </h1>
        <p
          class="lead"
          style="margin-top:1.5rem;max-width:54ch;color:var(--on-storm);font-weight:450"
        >
          A full-stack web framework with file-based routing, server loaders, SSR, and
          API routes. Powered by a Rust toolchain (oxc): dev server ready in about 90
          milliseconds, rebuilds in single milliseconds. Build dynamic apps without the
          wait.
        </p>

        <div
          class="reveal"
          style="margin-top:2.2rem;max-width:30rem;display:flex;flex-direction:column;gap:.7rem;animation-delay:.2s"
        >
          <CopyCommand cmd="npm create nowaki my-app" primary />
          <div style="display:flex;gap:.7rem;flex-wrap:wrap">
            <div style="flex:1;min-width:14rem"><CopyCommand cmd="cargo install nowaki" /></div>
          </div>
        </div>

        <p
          style="margin-top:1.4rem;font-size:.92rem;color:var(--on-storm);font-weight:500"
        >
          Alpha. Not for production yet, but real, and really fast.
        </p>
      </div>
    </header>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style="font-size:clamp(2.1rem,1.4rem + 2.6vw,3.3rem);font-weight:800;letter-spacing:-0.03em;color:var(--primary-strong);line-height:1">
        {value}
      </div>
      <p style="margin-top:.6rem;color:var(--muted);max-width:26ch">{label}</p>
    </div>
  );
}

function SpeedProof() {
  return (
    <section class="section wrap">
      <h2 class="h-sec" style="max-width:18ch">Speed you feel on every keystroke.</h2>
      <p class="lead measure" style="margin-top:1.1rem">
        Next.js gives you a full-stack framework on a JavaScript toolchain. Nowaki gives
        you the same kind of framework on Rust (oxc), so the dev server boots, transforms,
        and rebuilds before a JavaScript bundler has finished warming up.
      </p>
      <div
        style="margin-top:2.8rem;display:grid;gap:2.2rem;grid-template-columns:1fr"
        class="sm:grid-cols-3"
      >
        <Stat value="~90 ms" label="Dev server ready, measured on the example app." />
        <Stat
          value="milliseconds"
          label="To re-transform a changed file with oxc. No JavaScript bundler warm-up."
        />
        <Stat
          value="0 KB"
          label="JavaScript for the page shell and server loaders. Only islands ship."
        />
      </div>
    </section>
  );
}

function Step({ cmd, title: t, children }: { cmd: string; title: string; children: any }) {
  return (
    <div>
      <code style="display:inline-block;font-size:.82rem;padding:.4rem .65rem;border-radius:.5rem;background:var(--bg);border:1px solid var(--line);color:var(--primary-strong)">
        {cmd}
      </code>
      <h3 style="margin-top:.95rem;font-size:1.2rem;letter-spacing:-0.02em">{t}</h3>
      <p style="margin-top:.5rem;color:var(--muted);max-width:46ch">{children}</p>
    </div>
  );
}

function HowItWorks() {
  return (
    <section style="background:var(--surface);border-block:1px solid var(--line)">
      <div class="section wrap">
        <h2 class="h-sec" style="max-width:16ch">From nothing to a running app.</h2>
        <div
          style="margin-top:2.6rem;display:grid;gap:2.2rem;grid-template-columns:1fr"
          class="md:grid-cols-3"
        >
          <Step cmd="npm create nowaki" title="Scaffold">
            Lays down file-based <code style="color:var(--ink)">routes/</code> and{" "}
            <code style="color:var(--ink)">islands/</code> you can edit right away.
          </Step>
          <Step cmd="nowaki dev" title="Develop">
            Transforms on demand with the Rust oxc pipeline. Islands hydrate; everything
            else stays HTML.
          </Step>
          <Step cmd="nowaki build · start" title="Ship">
            Emits content-hashed ESM and SSR modules, then serves them in production.
          </Step>
        </div>
      </div>
    </section>
  );
}

function CodeExample() {
  return (
    <section class="section wrap">
      <div style="display:grid;gap:clamp(1.5rem,4vw,3rem);grid-template-columns:1fr" class="md:grid-cols-[0.85fr_1.15fr] md:items-center">
        <div>
          <h2 class="h-sec">Write a route. Mark an island.</h2>
          <p class="lead measure" style="margin-top:1.1rem">
            A route is a component with an optional <code style="color:var(--ink)">loader</code>{" "}
            that runs only on the server. Drop in a component from{" "}
            <code style="color:var(--ink)">islands/</code> and it, and only it, hydrates
            in the browser.
          </p>
        </div>
        <pre class="code reveal" aria-label="Example Nowaki route">
          <code dangerouslySetInnerHTML={{ __html: codeHtml }} />
        </pre>
      </div>
    </section>
  );
}

function Feature({ title: t, children }: { title: string; children: any }) {
  return (
    <div style="padding-block:1.5rem">
      <h3 style="font-size:1.15rem;letter-spacing:-0.02em">{t}</h3>
      <p style="margin-top:.5rem;color:var(--muted);max-width:52ch">{children}</p>
    </div>
  );
}

function Features() {
  return (
    <section style="background:var(--surface);border-block:1px solid var(--line)">
      <div class="section wrap">
        <h2 class="h-sec" style="max-width:16ch">A real framework, not a static-site generator.</h2>
        <p class="lead measure" style="margin-top:1.1rem">
          Nowaki is built for dynamic apps in the Next.js and Remix lineage, with the
          parts you actually ship a product on.
        </p>
        <div
          style="margin-top:2rem;display:grid;grid-template-columns:1fr;column-gap:3rem"
          class="md:grid-cols-2"
        >
          <div style="border-top:1px solid var(--line)">
            <Feature title="Full-stack, dynamic by default">
              File-based <code style="color:var(--ink)">routes/</code>, server{" "}
              <code style="color:var(--ink)">loader</code>s, SSR on every request, and{" "}
              <code style="color:var(--ink)">routes/api/</code> handlers. Not just static
              pages.
            </Feature>
          </div>
          <div style="border-top:1px solid var(--line)">
            <Feature title="Rust toolchain (oxc)">
              Parsing, transforming, resolving and bundling run in Rust, for fast cold
              starts and millisecond rebuilds. This is the part that makes it quick.
            </Feature>
          </div>
          <div style="border-top:1px solid var(--line)">
            <Feature title="Islands by default">
              Pages render to HTML on the server. Only components under{" "}
              <code style="color:var(--ink)">islands/</code> ship and hydrate, so apps stay
              light without extra work.
            </Feature>
          </div>
          <div style="border-top:1px solid var(--line)">
            <Feature title="npm ecosystem, intact">
              SSR runs on a Node sidecar with Preact, so your existing packages keep
              working.
            </Feature>
          </div>
        </div>
      </div>
    </section>
  );
}

function AlphaNote() {
  const works = [
    "nowaki dev / build / start",
    "Islands hydration",
    "File-based routes + loaders",
    "API routes",
    "create-nowaki scaffolding",
  ];
  const soon = [
    "Error overlay",
    "Stateful (prefresh) HMR",
    "CSS handling & scoped styles",
    "Chunk bundling (scope hoisting)",
  ];
  return (
    <section class="section wrap">
      <h2 class="h-sec">Honest about alpha.</h2>
      <p class="lead measure" style="margin-top:1.1rem">
        Nowaki is young. The core loop is real and verified end to end. Here's exactly
        where it stands.
      </p>
      <div
        style="margin-top:2rem;display:grid;gap:2rem;grid-template-columns:1fr"
        class="md:grid-cols-2"
      >
        <div>
          <h3 style="font-size:1rem;font-family:'JetBrains Mono',monospace;letter-spacing:.02em">
            Works today
          </h3>
          <ul style="margin-top:.9rem;list-style:none;padding:0;display:flex;flex-direction:column;gap:.55rem">
            {works.map((w) => (
              <li style="display:flex;gap:.7rem;align-items:baseline">
                <span aria-hidden="true" style="color:var(--primary)">→</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 style="font-size:1rem;font-family:'JetBrains Mono',monospace;letter-spacing:.02em;color:var(--muted)">
            On the roadmap
          </h3>
          <ul style="margin-top:.9rem;list-style:none;padding:0;display:flex;flex-direction:column;gap:.55rem;color:var(--muted)">
            {soon.map((s) => (
              <li style="display:flex;gap:.7rem;align-items:baseline">
                <span aria-hidden="true">○</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p style="margin-top:2rem">
        <a class="link-u" href={`${GH}/blob/main/ROADMAP.md`}>
          Read the full roadmap →
        </a>
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer class="storm" style="background:var(--storm)">
      <div class="wrap z1 section" style="padding-block:clamp(3rem,4vw,4.5rem)">
        <div style="display:flex;flex-wrap:wrap;gap:2rem;justify-content:space-between;align-items:flex-start">
          <div style="max-width:30ch">
            <div style="display:flex;align-items:baseline;gap:.5rem">
              <span style="font-weight:800;font-size:1.25rem;letter-spacing:-0.03em">Nowaki</span>
              <span class="on-storm-muted" style="font-size:.8rem">野分</span>
            </div>
            <p class="on-storm-muted" style="margin-top:.7rem;font-size:.92rem;color:var(--on-storm-muted)">
              A Rust-toolchain full-stack web framework. Zero JS by default.
            </p>
          </div>
          <nav
            aria-label="Footer"
            style="display:flex;gap:2.5rem;font-size:.92rem;flex-wrap:wrap"
          >
            <div style="display:flex;flex-direction:column;gap:.6rem">
              <a class="on-storm-muted hover:text-onstorm" href={GH}>GitHub ↗</a>
              <a class="on-storm-muted hover:text-onstorm" href={CRATES}>crates.io ↗</a>
              <a class="on-storm-muted hover:text-onstorm" href={NPM}>npm ↗</a>
            </div>
          </nav>
        </div>
        <hr style="height:1px;border:0;background:oklch(1 0 0 / 0.1);margin-block:2rem" />
        <div
          class="on-storm-muted"
          style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:space-between;font-size:.82rem;color:var(--on-storm-muted)"
        >
          <span>MIT © 2026 Voredge</span>
          <span>野分 · an autumn typhoon wind</span>
        </div>
        <p
          class="on-storm-muted"
          style="margin-top:1.1rem;font-size:.76rem;color:var(--on-storm-muted);max-width:64ch"
        >
          Next.js is a trademark of Vercel, Inc. Nowaki is an independent project and is
          not affiliated with or endorsed by Vercel.
        </p>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <>
      <Hero />
      <main>
        <SpeedProof />
        <HowItWorks />
        <CodeExample />
        <Features />
        <AlphaNote />
      </main>
      <Footer />
    </>
  );
}
