export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];

export const GH = "https://github.com/nowaki-dev/nowaki";
export const CRATES = "https://crates.io/crates/nowaki";
export const NPM = "https://www.npmjs.com/package/create-nowaki";

export const STRINGS = {
  en: {
    title: "Nowaki: a full-stack web framework with Rust-grade speed",
    desc: "Nowaki (野分) is a full-stack web framework with routing, server loaders, SSR and API routes, on a Rust toolchain. Dev server ready in ~90ms, millisecond rebuilds. Full-stack like Next.js, fast like Rust.",
    ogTitle: "Nowaki: full-stack like Next.js, fast like Rust",
    nav: { docs: "Docs", github: "GitHub" },
    hero: {
      badge: "v0.1 · alpha",
      h1a: "Full-stack like Next.js.",
      h1b: "Fast like Rust.",
      sub: "A full-stack web framework with file-based routing, server loaders, SSR, and API routes. Powered by a Rust toolchain (oxc): dev server ready in about 90 milliseconds, rebuilds in single milliseconds. Build dynamic apps without the wait.",
      alpha: "Alpha. Not for production yet, but real, and really fast.",
    },
    speed: {
      h2: "Speed you feel on every keystroke.",
      lead: "Next.js gives you a full-stack framework on a JavaScript toolchain. Nowaki gives you the same kind of framework on Rust (oxc), so the dev server boots, transforms, and rebuilds before a JavaScript bundler has finished warming up.",
      stats: [
        { value: "~90 ms", label: "Dev server ready, measured on the example app." },
        { value: "milliseconds", label: "To re-transform a changed file with oxc. No JavaScript bundler warm-up." },
        { value: "0 KB", label: "JavaScript for the page shell and server loaders. Only islands ship." },
      ],
    },
    how: {
      h2: "From nothing to a running app.",
      steps: [
        { cmd: "npm create nowaki", title: "Scaffold", body: `Lays down file-based <code style="color:var(--ink)">routes/</code> and <code style="color:var(--ink)">islands/</code> you can edit right away.` },
        { cmd: "nowaki dev", title: "Develop", body: "Transforms on demand with the Rust oxc pipeline. Islands hydrate; everything else stays HTML." },
        { cmd: "nowaki build · start", title: "Ship", body: "Emits content-hashed ESM and SSR modules, then serves them in production." },
      ],
    },
    code: {
      h2: "Write a route. Mark an island.",
      lead: `A route is a component with an optional <code style="color:var(--ink)">loader</code> that runs only on the server. Drop in a component from <code style="color:var(--ink)">islands/</code> and it, and only it, hydrates in the browser.`,
      commentTop: "// routes/index.tsx, runs on the server only",
      commentInline: "// only this hydrates",
      serverMsg: "Hello from the server",
    },
    features: {
      h2: "A real framework, not a static-site generator.",
      lead: "Nowaki is built for dynamic apps in the Next.js and Remix lineage, with the parts you actually ship a product on.",
      items: [
        { title: "Full-stack, dynamic by default", body: `File-based <code style="color:var(--ink)">routes/</code>, server <code style="color:var(--ink)">loader</code>s, SSR on every request, and <code style="color:var(--ink)">routes/api/</code> handlers. Not just static pages.` },
        { title: "Rust toolchain (oxc)", body: "Parsing, transforming, resolving and bundling run in Rust, for fast cold starts and millisecond rebuilds. This is the part that makes it quick." },
        { title: "Islands by default", body: `Pages render to HTML on the server. Only components under <code style="color:var(--ink)">islands/</code> ship and hydrate, so apps stay light without extra work.` },
        { title: "npm ecosystem, intact", body: "SSR runs on a Node sidecar with Preact, so your existing packages keep working." },
      ],
    },
    alpha: {
      h2: "Honest about alpha.",
      lead: "Nowaki is young. The core loop is real and verified end to end. Here's exactly where it stands.",
      worksTitle: "Works today",
      works: ["nowaki dev / build / start", "Islands hydration", "File-based routes + loaders", "API routes", "create-nowaki scaffolding"],
      soonTitle: "On the roadmap",
      soon: ["Error overlay", "Stateful (prefresh) HMR", "CSS handling & scoped styles", "Chunk bundling (scope hoisting)"],
      roadmap: "Read the full roadmap →",
    },
    footer: {
      tagline: "A Rust-toolchain full-stack web framework. Zero JS by default.",
      copyright: "MIT © 2026 Voredge",
      windName: "野分 · an autumn typhoon wind",
      trademark: "Next.js is a trademark of Vercel, Inc. Nowaki is an independent project and is not affiliated with or endorsed by Vercel.",
    },
    copy: { copy: "copy", copied: "copied ✓" },
  },

  ja: {
    title: "Nowaki: Rust製ツールチェーンの爆速フルスタックWebフレームワーク",
    desc: "Nowaki（野分）は routing・server loader・SSR・API routes を備えたフルスタックWebフレームワーク。Rust ツールチェーン上で動き、dev 起動 約90ms、再ビルドは数ミリ秒。Next.js のようなフルスタック、Rust の速さ。",
    ogTitle: "Nowaki: Next.js のようなフルスタック、Rust の速さ",
    nav: { docs: "ドキュメント", github: "GitHub" },
    hero: {
      badge: "v0.1 · alpha",
      h1a: "Next.js のようなフルスタック。",
      h1b: "Rust の速さ。",
      sub: "routing・server loader・SSR・API routes を備えたフルスタックWebフレームワーク。Rust ツールチェーン（oxc）が dev 起動を約90ミリ秒、再ビルドを数ミリ秒に。動的なアプリを、待たずに作れます。",
      alpha: "alpha 版。まだ本番向けではありませんが、実在し、本当に速い。",
    },
    speed: {
      h2: "打鍵ごとに感じる速さ。",
      lead: "Next.js は JavaScript ツールチェーン上のフルスタック。Nowaki は同じ種類のフレームワークを Rust（oxc）の上で動かすので、JavaScript バンドラーが温まりきる前に、dev サーバーは起動し、変換し、再ビルドを終えています。",
      stats: [
        { value: "~90 ms", label: "サンプルアプリで実測した dev サーバー起動。" },
        { value: "数ミリ秒", label: "oxc による変更ファイルの再変換。JS バンドラーのウォームアップなし。" },
        { value: "0 KB", label: "ページの土台と server loader の JavaScript。送るのは島だけ。" },
      ],
    },
    how: {
      h2: "何もない状態から、動くアプリへ。",
      steps: [
        { cmd: "npm create nowaki", title: "雛形作成", body: `file-based の <code style="color:var(--ink)">routes/</code> と <code style="color:var(--ink)">islands/</code> を生成。すぐ編集できます。` },
        { cmd: "nowaki dev", title: "開発", body: "Rust の oxc パイプラインがオンデマンドで変換。島はハイドレートし、それ以外は HTML のまま。" },
        { cmd: "nowaki build · start", title: "公開", body: "content-hash 付き ESM と SSR モジュールを出力し、本番配信します。" },
      ],
    },
    code: {
      h2: "ルートを書き、島を印す。",
      lead: `ルートは、サーバーでのみ走る任意の <code style="color:var(--ink)">loader</code> を持つコンポーネント。<code style="color:var(--ink)">islands/</code> のコンポーネントを置けば、それだけがブラウザでハイドレートします。`,
      commentTop: "// routes/index.tsx, サーバーでのみ実行",
      commentInline: "// ハイドレートするのはこれだけ",
      serverMsg: "サーバーからこんにちは",
    },
    features: {
      h2: "静的サイトジェネレータではない、本物のフレームワーク。",
      lead: "Nowaki は Next.js / Remix 系譜の動的なアプリ向けに作られ、実際にプロダクトを載せられる部品が揃っています。",
      items: [
        { title: "デフォルトでフルスタック・動的", body: `file-based の <code style="color:var(--ink)">routes/</code>、server <code style="color:var(--ink)">loader</code>、毎リクエストの SSR、そして <code style="color:var(--ink)">routes/api/</code> ハンドラ。静的ページだけではありません。` },
        { title: "Rust ツールチェーン (oxc)", body: "パース・変換・解決・バンドルが Rust で動き、高速なコールドスタートと数ミリ秒の再ビルドを実現。速さの正体はここです。" },
        { title: "デフォルトで Islands", body: `ページはサーバーで HTML に描画。<code style="color:var(--ink)">islands/</code> 配下のコンポーネントだけが配信・ハイドレートされ、追加作業なしでアプリは軽いまま。` },
        { title: "npm エコシステムそのまま", body: "SSR は Preact の Node サイドカーで動くので、既存のパッケージがそのまま使えます。" },
      ],
    },
    alpha: {
      h2: "alpha について正直に。",
      lead: "Nowaki はまだ若い。コアの一連の流れは実在し、端から端まで検証済みです。現在地を正確に示します。",
      worksTitle: "今できること",
      works: ["nowaki dev / build / start", "Islands のハイドレーション", "file-based ルート + loader", "API ルート", "create-nowaki の雛形作成"],
      soonTitle: "ロードマップ",
      soon: ["エラーオーバーレイ", "状態保持 (prefresh) HMR", "CSS 対応 & scoped styles", "チャンクバンドリング (scope hoisting)"],
      roadmap: "ロードマップ全文を読む →",
    },
    footer: {
      tagline: "Rust ツールチェーンのフルスタックWebフレームワーク。デフォルトで JS ゼロ。",
      copyright: "MIT © 2026 Voredge",
      windName: "野分 · 秋の台風の風",
      trademark: "Next.js は Vercel, Inc. の商標です。Nowaki は独立したプロジェクトであり、Vercel との提携・公認関係はありません。",
    },
    copy: { copy: "コピー", copied: "コピー済 ✓" },
  },
} as const;

// 共有の <head> 中身（locale非依存）: フォント, Tailwind, デザインのCSSトークン/スタイル。
const HEAD_STYLE = `
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

  .storm{ background:
    radial-gradient(70% 80% at 92% -25%, var(--storm-2), transparent 50%),
    var(--storm);
    color:var(--on-storm); position:relative; overflow:hidden; isolation:isolate;
  }
  .wind-canvas{ position:absolute; inset:0; width:100%; height:100%; z-index:0; pointer-events:none;
    mask-image: linear-gradient(90deg, transparent 0%, transparent 72%, #000 86%, #000 97%, transparent 100%);
  }
  .storm__scrim{ position:absolute; inset:0; z-index:0; pointer-events:none;
    background:linear-gradient(90deg, rgba(11,16,26,0.82) 0%, rgba(11,16,26,0.6) 52%, transparent 76%); }
  .z1{ position:relative; z-index:1 }
  .hero-title{ font-size:clamp(2.7rem,1.55rem + 6.2vw,5.4rem); letter-spacing:-0.038em; line-height:1.0 }
  .mark{ color:var(--cyan) }
  .on-storm-muted{ color:var(--on-storm-muted) }
  .lang a{ color:var(--on-storm-muted) }
  .lang a[aria-current="true"]{ color:var(--on-storm); font-weight:600 }

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

  .code{ background:var(--storm); color:var(--on-storm); border-radius:.95rem; padding:1.35rem 1.5rem; overflow:auto;
    font-size:.86rem; line-height:1.75; margin:0; tab-size:2 }
  .code .k{ color:#c7adff } .code .s{ color:#9fe3b6 } .code .c{ color:oklch(0.68 0.02 256) }
  .code .f{ color:var(--cyan) } .code .a{ color:#ffc08a }

  .link-u{ color:var(--primary-strong); text-decoration:underline; text-underline-offset:3px; text-decoration-thickness:1px }
  .link-u:hover{ text-decoration-thickness:2px }

  @media (prefers-reduced-motion: reduce){ html{ scroll-behavior:auto } }
</style>
`;

export function headFor(locale: Locale): string {
  const s = STRINGS[locale];
  const url = locale === "ja" ? "https://nowaki.dev/ja" : "https://nowaki.dev/";
  return `
<meta name="description" content="${s.desc}" />
<meta name="theme-color" content="#0b1220" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${s.ogTitle}" />
<meta property="og:description" content="${s.desc}" />
<meta property="og:locale" content="${locale === "ja" ? "ja_JP" : "en_US"}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="alternate" hreflang="en" href="https://nowaki.dev/" />
<link rel="alternate" hreflang="ja" href="https://nowaki.dev/ja" />
<link rel="alternate" hreflang="x-default" href="https://nowaki.dev/" />
${HEAD_STYLE}`;
}
