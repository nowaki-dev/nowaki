export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];

export const GH = "https://github.com/nowaki-dev/nowaki";
export const CRATES = "https://crates.io/crates/nowaki";
export const NPM = "https://www.npmjs.com/package/nowaki";

export const STRINGS = {
  en: {
    title: "Nowaki: a Rust-fast full-stack web framework you install with npm",
    desc: "Nowaki (野分) is a full-stack web framework with layouts, middleware, server loaders, actions, SSR and API routes, on a Rust toolchain (oxc). It renders to HTML and hydrates only the islands you mark. Dev server ready in about 90ms, millisecond rebuilds, and you install it with npm: no Rust required. Full-stack like Next.js, islands like Astro.",
    ogTitle: "Nowaki: full-stack like Next.js, islands like Astro, installed with npm",
    nav: { docs: "Docs", github: "GitHub" },
    hero: {
      badge: "Beta · server functions · alpha",
      h1a: "Full-stack like Next.js.",
      h1b: "Islands like Astro.",
      sub: "Layouts, middleware, server loaders, actions, SSR, and API routes. Pages render to HTML and only the islands you mark hydrate. The whole toolchain is Rust (oxc), so the dev server is ready in about 90 milliseconds and rebuilds land in single milliseconds.",
      rustfree: "Installs with npm. No Rust toolchain required: the CLI ships as a prebuilt native binary.",
      alpha: "Alpha. Not for production yet, but real, fast, and published on npm and crates.io.",
    },
    ship: {
      h2: "This page ships 12 KB of JavaScript.",
      lead: "Everything interactive on this site, the wind animation, the copy buttons, and the scroll choreography, is 12 KB gzipped with Preact included. A page with no islands ships zero. For comparison, React and ReactDOM alone are about 45 KB gzipped, before any of your own code.",
      bars: [
        { label: "This page (islands + wind + motion)", value: "12 KB", pct: 27 },
        { label: "A content page, no islands", value: "0 KB", pct: 1, zero: true },
        { label: "React + ReactDOM, baseline only", value: "~45 KB", pct: 100, muted: true },
      ],
      note: "Measured on this site's own production build (it is built with Nowaki). Head-to-head, on the same one-counter app: a Nowaki page first-loads ~10 KB gzip, on par with Astro and roughly 5× less than Next's app-router baseline (~103 KB). Reproduce it with benchmarks/head-to-head.mjs.",
    },
    speed: {
      h2: "Speed you feel on every keystroke.",
      lead: "Most JavaScript frameworks boot, transform, and rebuild on a JavaScript toolchain. Nowaki runs that whole pipeline in Rust (oxc), so the dev server is serving before a JavaScript bundler has finished warming up.",
      stats: [
        { value: "~90 ms", label: "Dev server ready, measured on the example app." },
        { value: "milliseconds", label: "To re-transform a changed file with oxc. No JavaScript bundler warm-up." },
        { value: "scope-hoisted", label: "Production output: modules concatenated into one scope, tree-shaken, content-hashed, with source maps." },
      ],
    },
    how: {
      h2: "From nothing to a running app, without Rust.",
      steps: [
        { cmd: "npm create nowaki@latest", title: "Scaffold", body: `Lays down file-based <code>routes/</code> and <code>islands/</code>. The CLI is a prebuilt binary, so there is no Rust to install.` },
        { cmd: "npm run dev", title: "Develop", body: "The Rust oxc pipeline transforms on demand. Islands hydrate; everything else stays HTML. Errors show as a full-screen overlay." },
        { cmd: "npm run build · start", title: "Ship", body: "Scope-hoisted, content-hashed ESM and SSR modules, served in production. Or prerender to static and put it on a CDN." },
      ],
    },
    code: {
      h2: "Write a route. Mark an island. Handle a form.",
      lead: `Routes are components with an optional server-only <code>loader</code>. A non-GET request runs the route's <code>action</code>. Components under <code>islands/</code> are the only thing that hydrates.`,
      tabs: ["A route with a loader", "A form with an action", "File conventions"],
      conventions: [
        { f: "routes/_layout.tsx", d: "Shared layout, nests per directory" },
        { f: "routes/_middleware.ts", d: "Runs before routes; auth, redirects, headers" },
        { f: "routes/blog/[slug].tsx", d: "Dynamic route + server loader" },
        { f: "routes/api/posts.ts", d: "GET / POST handlers, streaming Response" },
        { f: "routes/_404.tsx · _500.tsx", d: "Not-found and error pages" },
        { f: "islands/Counter.tsx", d: "Hydrates in the browser. Nothing else does." },
      ],
    },
    compare: {
      h2: "Honestly, next to Next and Astro.",
      lead: "None of these ideas is new on its own. Nowaki's bet is the combination. Here is where it actually differs, without spin.",
      cols: ["Nowaki", "Next.js", "Astro"],
      rows: [
        { feature: "Server-reactive islands (zero client JS)", nowaki: "Jetstream — state on the server, HTML patches over a WebSocket, no component JS", next: "RSC re-renders ship the React runtime", astro: "Server Islands defer SSR (one-shot, not live)", highlight: true },
        { feature: "Toolchain", nowaki: "Rust (oxc), from scratch — and in the production request path", next: "Turbopack (SWC), JS runtime", astro: "Vite → Rolldown, JS runtime" },
        { feature: "JavaScript by default", nowaki: "Zero, islands only", next: "Ships React + hydrates", astro: "Zero, islands only" },
        { feature: "Full-stack app DX", nowaki: "Routing, loaders, actions, middleware, API, server functions", next: "Yes, mature", astro: "Growing, content-first" },
        { feature: "Install without the toolchain's language", nowaki: "npm, no Rust", next: "npm", astro: "npm" },
        { feature: "Maturity", nowaki: "Alpha", next: "Mature, huge ecosystem", astro: "Mature" },
      ],
      only: "Only here: a <b>live, stateful island that ships zero component JavaScript</b>. The server holds the state and pushes HTML patches over a WebSocket — LiveView's idea, fused with islands. RSC re-renders still ship React; Astro's Server Islands defer the initial render but don't update live. This is the one thing neither framework has.",
      note: "Server functions, streaming SSR, plugins, and deploy adapters are parity, not differentiators — Astro and Next have their own. The real edge is Jetstream, the Rust production runtime, and hitting all of full-stack + zero-JS + npm-install at once. Next and Astro are mature and battle-tested; Nowaki is alpha.",
    },
    positioning: {
      h2: "Who it's for.",
      lead: "Nowaki fits apps that are content-heavy but still dynamic: marketing with auth, docs with interactive widgets, dashboards with real server data, commerce. The kind of page that is mostly text and server data, where a full-hydrate framework still ships a megabyte of JavaScript.",
      forTitle: "A good fit",
      for: [
        "You write Next.js-style apps but most of each page is static content and server data.",
        "You want forms, auth, and dynamic routes without paying for a full client runtime on every page.",
        "You like the Remix-style loader and action model, with the parts shipped only where they're used.",
      ],
      notTitle: "Not the sweet spot yet",
      not: [
        "Fully interactive single-page apps where almost everything is stateful. Islands fight you there, and full hydration or RSC fits better.",
        "Production-critical work today: Nowaki is alpha and the API still moves.",
      ],
    },
    features: {
      h2: "A real framework, not a static-site generator.",
      lead: "Built for dynamic apps in the Next.js and Remix lineage, with the parts you actually ship a product on.",
      items: [
        { title: "Full-stack routing", body: `File-based <code>routes/</code> with nested <code>_layout</code>s, <code>_middleware</code>, server <code>loader</code>s, <code>action</code>s for forms, and <code>api/</code> handlers with method dispatch and streaming.` },
        { title: "Islands, zero JS by default", body: `Pages render to HTML on the server. Only components under <code>islands/</code> ship and hydrate, so a page costs only what it actually uses.` },
        { title: "Server functions (\"use server\")", body: `A module with a <code>"use server"</code> directive becomes an RPC boundary. Its exports run only on the server; the client gets a tiny <code>fetch</code> proxy (no implementation, no server-only deps). Dispatch is allowlisted, and <code>getContext()</code> exposes the request's cookies and headers.` },
        { title: "Jetstream islands (server-reactive)", body: `Mark an island <code>export const live</code> and it ships <strong>no component JavaScript</strong>: state stays on the server, clicks go over a WebSocket, the Rust server re-renders and pushes an HTML patch, and a ~2&nbsp;KB runtime morphs it in. Presence, heartbeat, and connection scaling included. Client islands (optimistic UI) coexist on the same page.` },
        { title: "Rust toolchain (oxc)", body: "Parse, transform, resolve, bundle, minify, and scope-hoist run in Rust. Fast cold starts, millisecond rebuilds, and a persistent disk cache across restarts." },
        { title: "Installs with npm, no Rust", body: "The CLI ships as prebuilt native binaries through npm's optional dependencies. No cargo, no toolchain, no postinstall." },
        { title: "Island-to-island SPA router", body: "Navigation between island pages is client-side and instant, with prefetch and scroll restoration. Pages with no islands stay zero-JS and navigate normally." },
        { title: "CSS Modules, assets, source maps", body: `<code>*.module.css</code> with scoped class names, hashed <code>import</code>s for images and fonts, and end-to-end source maps in dev and prod.` },
        { title: "npm ecosystem, intact", body: "SSR runs on a Rust-managed Node sidecar with Preact, so your existing packages keep working." },
        { title: "Honest dev experience", body: "Full-screen error overlay, code-frame diagnostics, hot reload, and live island swap on save." },
      ],
    },
    alpha: {
      h2: "Honest about alpha.",
      lead: "Nowaki is young, but the core is real and verified end to end, including in headless Chrome. Here is exactly where it stands.",
      worksTitle: "Works today",
      works: [
        "dev / build / start / prerender",
        "Layouts, middleware, actions, API routes",
        "Islands + island-to-island SPA router",
        "Server functions (\"use server\") RPC",
        "Jetstream islands: server-reactive, zero client JS",
        "Jetstream presence + connection scaling (heartbeat, cap)",
        "Plugin virtual modules (resolveId / load) + transform hooks",
        "CSS Modules, asset imports, source maps",
        "Scope-hoisted production bundles",
        "Deploy adapters: Node, static, Bun, Deno, Cloudflare edge",
        "Streaming SSR, config plugins, TSRX (.tsrx) islands",
        "Head-to-head benchmarks vs Next and Astro",
        "Rust prod hot path + Rust-free install via npm",
      ],
      soonTitle: "On the roadmap",
      soon: [
        "State-preserving (prefresh) HMR",
        "Scoped CSS for TSRX islands",
        "RSC-style streaming boundaries",
        "Stabilizing the public API toward 1.0",
      ],
      roadmap: "Read the full roadmap →",
    },
    footer: {
      tagline: "A Rust-toolchain full-stack web framework. Zero JS by default, installed with npm.",
      copyright: "MIT © 2026 VorEdge",
      windName: "野分 · an autumn typhoon wind",
      trademark: "Next.js is a trademark of Vercel, Inc. Astro is a trademark of The Astro Technology Company. Nowaki is an independent project, not affiliated with or endorsed by either.",
    },
    copy: { copy: "copy", copied: "copied ✓" },
  },

  ja: {
    title: "Nowaki: npm で入る、Rust 製ツールチェーンの高速フルスタックWebフレームワーク",
    desc: "Nowaki（野分）は layout・middleware・server loader・action・SSR・API routes を備えたフルスタックWebフレームワーク。Rust ツールチェーン（oxc）の上で動き、ページを HTML に描画し、マークした島だけをハイドレートします。dev 起動は約90ms、再ビルドは数ミリ秒、そして npm で入ります（Rust 不要）。Next.js のようなフルスタック、Astro のような Islands。",
    ogTitle: "Nowaki: Next.js のようなフルスタック、Astro のような Islands、npm で入る",
    nav: { docs: "ドキュメント", github: "GitHub" },
    hero: {
      badge: "Beta · server functions · alpha",
      h1a: "Next.js のような、フルスタック。",
      h1b: "Astro のような、Islands。",
      sub: "layout・middleware・server loader・action・SSR・API routes。ページは HTML に描画され、マークした島だけがハイドレートします。ツールチェーン全体が Rust（oxc）なので、dev 起動は約90ミリ秒、再ビルドは数ミリ秒で完了します。",
      rustfree: "npm で入ります。Rust ツールチェーンは不要で、CLI はプリビルドのネイティブバイナリとして配布します。",
      alpha: "alpha 版。まだ本番向けではありませんが、実在し、実際に速く、npm と crates.io で公開済みです。",
    },
    ship: {
      h2: "このページが送る JavaScript は 12 KB。",
      lead: "このサイトで動く部分すべて、風のアニメーション・コピーボタン・スクロール演出を合わせて、Preact 込みで gzip 後 12 KB です。島の無いページは 0 KB。参考までに、React と ReactDOM だけで gzip 後およそ 45 KB。まだ自分のコードを 1 行も書いていない段階で、です。",
      bars: [
        { label: "このページ（島3つ + 風 + モーション）", value: "12 KB", pct: 27 },
        { label: "コンテンツだけのページ（島なし）", value: "0 KB", pct: 1, zero: true },
        { label: "React + ReactDOM の土台だけ", value: "約45 KB", pct: 100, muted: true },
      ],
      note: "このサイト自身の本番ビルドで実測（このサイトは Nowaki 製です）。同一のカウンタ1個アプリで直接比較すると、Nowaki ページの first-load は約 10 KB(gzip)。Astro と同等で、Next の app-router 基準（約 103 KB）のおよそ 1/5 です。benchmarks/head-to-head.mjs で再現できます。",
    },
    speed: {
      h2: "打鍵ごとに感じる速さ。",
      lead: "多くの JavaScript フレームワークは、起動・変換・再ビルドを JavaScript ツールチェーンの上で行います。Nowaki はそのパイプライン全体を Rust（oxc）で動かすので、JavaScript バンドラーが温まりきる前に dev サーバーは応答しています。",
      stats: [
        { value: "~90 ms", label: "サンプルアプリで実測した dev サーバー起動。" },
        { value: "数ミリ秒", label: "oxc による変更ファイルの再変換。JS バンドラーのウォームアップなし。" },
        { value: "scope-hoisted", label: "本番出力: モジュールを1スコープへ連結、ツリーシェイク、content-hash、ソースマップ付き。" },
      ],
    },
    how: {
      h2: "何もない状態から、Rust なしで動くアプリへ。",
      steps: [
        { cmd: "npm create nowaki@latest", title: "雛形作成", body: `file-based の <code>routes/</code> と <code>islands/</code> を生成。CLI はプリビルドのバイナリなので、Rust を入れる必要はありません。` },
        { cmd: "npm run dev", title: "開発", body: "Rust の oxc パイプラインがオンデマンドで変換。島はハイドレートし、それ以外は HTML のまま。エラーは全画面オーバーレイで表示。" },
        { cmd: "npm run build · start", title: "公開", body: "scope-hoisting 済み・content-hash 付きの ESM と SSR モジュールを本番配信。あるいは静的に prerender して CDN へ。" },
      ],
    },
    code: {
      h2: "ルートを書き、島をマークし、フォームを処理する。",
      lead: `ルートは、サーバーでのみ走る任意の <code>loader</code> を持つコンポーネント。非 GET リクエストはルートの <code>action</code> が処理します。ブラウザでハイドレートするのは <code>islands/</code> のものだけです。`,
      tabs: ["loader 付きルート", "action 付きフォーム", "ファイル規約"],
      conventions: [
        { f: "routes/_layout.tsx", d: "共有レイアウト、ディレクトリ単位でネスト" },
        { f: "routes/_middleware.ts", d: "ルート前に実行。認証・リダイレクト・ヘッダ" },
        { f: "routes/blog/[slug].tsx", d: "動的ルート + server loader" },
        { f: "routes/api/posts.ts", d: "GET / POST ハンドラ、streaming Response" },
        { f: "routes/_404.tsx · _500.tsx", d: "未一致ページとエラーページ" },
        { f: "islands/Counter.tsx", d: "ブラウザでハイドレート。それ以外はしない。" },
      ],
    },
    compare: {
      h2: "Next・Astro と並べて、正直に。",
      lead: "どのアイデアも単体では新しくありません。Nowaki の賭けはその組み合わせです。誇張なしで、実際にどこが違うかを示します。",
      cols: ["Nowaki", "Next.js", "Astro"],
      rows: [
        { feature: "サーバーリアクティブ島（クライアントJSゼロ）", nowaki: "Jetstream — 状態はサーバー、HTML パッチを WebSocket で push、コンポーネントJSゼロ", next: "RSC 再描画は React ランタイムを積む", astro: "Server Islands は SSR を遅延（一発・生更新ではない）", highlight: true },
        { feature: "ツールチェーン", nowaki: "Rust (oxc) を自作 — 本番リクエストパスも Rust", next: "Turbopack (SWC)、本番はJS", astro: "Vite → Rolldown、本番はJS" },
        { feature: "デフォルトの JavaScript", nowaki: "ゼロ、島だけ", next: "React を送り hydrate", astro: "ゼロ、島だけ" },
        { feature: "フルスタックなアプリ DX", nowaki: "routing・loader・action・middleware・API・サーバー関数", next: "あり、成熟", astro: "成長中・コンテンツ寄り" },
        { feature: "ツールチェーンの言語なしで入る", nowaki: "npm、Rust 不要", next: "npm", astro: "npm" },
        { feature: "成熟度", nowaki: "alpha", next: "成熟・巨大なエコシステム", astro: "成熟" },
      ],
      only: "ここだけ: <b>状態を持ち生更新するのに、コンポーネントJSをゼロで送る島</b>。状態はサーバーが持ち、HTML パッチを WebSocket で押し出します — LiveView の発想を島に融合。RSC 再描画は React を積み、Astro の Server Islands は初期描画を遅延するだけで生更新はしません。これが両者にない一点です。",
      note: "サーバー関数・ストリーミングSSR・プラグイン・デプロイアダプタは parity（同等）で差別化ではありません — Astro/Next にもあります。本当の強みは Jetstream、Rust の本番ランタイム、そして「フルスタック＋JSゼロ＋npmインストール」を同時に満たすこと。Next と Astro は成熟し実戦で揉まれていますが、Nowaki は alpha です。",
    },
    positioning: {
      h2: "どんなアプリに向くか。",
      lead: "Nowaki が向くのは、コンテンツ主体だが動的なアプリです。認証付きのマーケ、対話ウィジェット入りのドキュメント、本物のサーバーデータを持つ管理画面、EC。本文とサーバーデータが大半なのに、全 hydrate のフレームワークだと1ページに数百 KB の JavaScript を送ってしまう、その層です。",
      forTitle: "向いている",
      for: [
        "Next.js 風にアプリを書くが、各ページの大半は静的コンテンツとサーバーデータ。",
        "フォーム・認証・動的ルートが欲しいが、全ページにクライアントランタイムの代金は払いたくない。",
        "Remix 風の loader / action モデルが好きで、それを使う所にだけ JS を送りたい。",
      ],
      notTitle: "まだ得意でない",
      not: [
        "ほぼ全部が状態を持つ、全面インタラクティブな SPA。島はそこでは窮屈で、全 hydrate や RSC の方が合います。",
        "今日の本番クリティカルな用途。Nowaki は alpha で、API はまだ動きます。",
      ],
    },
    features: {
      h2: "静的サイトジェネレータではない、本物のフレームワーク。",
      lead: "Next.js / Remix 系譜の動的なアプリ向けに作られ、実際にプロダクトを載せられる部品が揃っています。",
      items: [
        { title: "フルスタックなルーティング", body: `file-based の <code>routes/</code> に、ネスト可能な <code>_layout</code>・<code>_middleware</code>・server <code>loader</code>・フォーム用の <code>action</code>、そしてメソッド分岐と streaming に対応した <code>api/</code> ハンドラ。` },
        { title: "デフォルトで島・JS ゼロ", body: `ページはサーバーで HTML に描画。<code>islands/</code> 配下のコンポーネントだけが配信・ハイドレートされ、ページが払うのは実際に使う分だけ。` },
        { title: "サーバー関数（\"use server\"）", body: `<code>"use server"</code> ディレクティブを持つモジュールは RPC 境界になります。export はサーバーにだけ残り、クライアントには fetch する極小プロキシだけ（実装もサーバー専用依存も出ません）。dispatch は allowlist 制で、<code>getContext()</code> からリクエストの cookie/ヘッダを読めます。` },
        { title: "Jetstream island（サーバーリアクティブ）", body: `島を <code>export const live</code> にすると<strong>コンポーネント JS をクライアントに送りません</strong>。状態はサーバーに置き、クリックは WebSocket で届き、Rust サーバーが再描画して HTML パッチを push、~2&nbsp;KB のランタイムが morph で当てます。presence・ハートビート・接続スケールも内蔵。クライアント島（楽観UI）と同一ページで共存します。` },
        { title: "Rust ツールチェーン (oxc)", body: "パース・変換・解決・バンドル・minify・スコープホイスティングが Rust で動作。高速なコールドスタート、数ミリ秒の再ビルド、再起動をまたぐ永続ディスクキャッシュ。" },
        { title: "npm で入る、Rust 不要", body: "CLI は npm の optionalDependencies でプリビルドのネイティブバイナリとして配布。cargo もツールチェーンも postinstall も不要。" },
        { title: "島間 SPA ルーター", body: "島のあるページ間の遷移はクライアント側で即時、prefetch とスクロール復元つき。島の無いページは JS ゼロのまま通常遷移。" },
        { title: "CSS Modules・アセット・ソースマップ", body: `クラス名をスコープ化する <code>*.module.css</code>、画像やフォントのハッシュ付き <code>import</code>、dev/prod 両方の end-to-end ソースマップ。` },
        { title: "npm エコシステムそのまま", body: "SSR は Rust が管理する Preact の Node サイドカーで動くので、既存のパッケージがそのまま使えます。" },
        { title: "正直な開発体験", body: "全画面エラーオーバーレイ、コードフレーム診断、ホットリロード、保存時の島ホットスワップ。" },
      ],
    },
    alpha: {
      h2: "alpha について正直に。",
      lead: "Nowaki はまだ若いですが、コアは実在し、ヘッドレス Chrome まで含めて端から端まで検証済みです。現在地を正確に示します。",
      worksTitle: "今できること",
      works: [
        "dev / build / start / prerender",
        "レイアウト・ミドルウェア・action・API ルート",
        "Islands + 島間 SPA ルーター",
        "サーバー関数（\"use server\"）RPC",
        "Jetstream island: サーバーリアクティブ・クライアント JS ゼロ",
        "Jetstream の presence・接続スケール（ハートビート・上限）",
        "プラグイン仮想モジュール（resolveId / load）+ transform フック",
        "CSS Modules・アセット import・ソースマップ",
        "スコープホイスティング済みの本番バンドル",
        "デプロイアダプタ: Node・静的・Bun・Deno・Cloudflare edge",
        "ストリーミング SSR・設定プラグイン・TSRX（.tsrx）島",
        "Next・Astro との直接ベンチ",
        "Rust 本番ホットパス + npm 経由の Rust 不要インストール",
      ],
      soonTitle: "ロードマップ",
      soon: [
        "状態保持（prefresh）HMR",
        "TSRX 島の scoped CSS",
        "RSC 風のストリーミング境界",
        "公開 API の安定化（1.0 へ）",
      ],
      roadmap: "ロードマップ全文を読む →",
    },
    footer: {
      tagline: "Rust ツールチェーンのフルスタックWebフレームワーク。デフォルトで JS ゼロ、npm で入る。",
      copyright: "MIT © 2026 VorEdge",
      windName: "野分 · 秋の台風の風",
      trademark: "Next.js は Vercel, Inc.、Astro は The Astro Technology Company の商標です。Nowaki は独立したプロジェクトであり、いずれとも提携・公認関係はありません。",
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
          muted: "var(--muted)", primary: "var(--primary)", ember: "var(--ember)",
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
<script>
  /* ヒーローの導入モーション用クラスを描画前に付ける（チラつき防止）。
     JS が動くブラウザだけが付与し、静的HTML/クローラ/JS無効では付かない＝常に見える。
     Animator が起動したら .anim-on を付け、起動しなければ保険で .anim を外して全表示。 */
  (function () {
    var d = document.documentElement;
    try { if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) { return; }
    d.classList.add("anim");
    setTimeout(function () { if (!d.classList.contains("anim-on")) d.classList.remove("anim"); }, 2200);
  })();
</script>
<style>
  :root{
    --bg: oklch(0.986 0.004 250);
    --surface: oklch(0.966 0.008 252);
    --ink: oklch(0.205 0.03 262);
    --muted: oklch(0.452 0.03 260);
    --faint: oklch(0.6 0.026 258);
    --line: oklch(0.9 0.012 256);
    --line-strong: oklch(0.84 0.016 256);
    --primary: oklch(0.52 0.17 256);
    --primary-strong: oklch(0.44 0.17 257);
    --ember: oklch(0.64 0.19 46);
    --ember-strong: oklch(0.55 0.2 41);
    --storm: oklch(0.175 0.035 264);
    --storm-2: oklch(0.245 0.052 266);
    --on-storm: oklch(0.97 0.012 250);
    --on-storm-muted: oklch(0.8 0.03 252);
    --cyan: oklch(0.87 0.1 228);
    --ease: cubic-bezier(0.22,1,0.36,1);
    --ease-expo: cubic-bezier(0.16,1,0.3,1);
  }
  *{ box-sizing:border-box }
  html{ -webkit-text-size-adjust:100%; scroll-behavior:smooth }
  body{
    margin:0; background:var(--bg); color:var(--ink);
    font-family:"Bricolage Grotesque", system-ui, sans-serif;
    font-optical-sizing:auto; -webkit-font-smoothing:antialiased;
    font-size:1.0625rem; line-height:1.62; overflow-x:hidden;
    /* 日本語は文節境界で折り返す（CJK のみ作用、英語は normal と同じ）。
       未対応ブラウザは無視。ヒーロー等は読点で改行点も明示している。 */
    word-break: auto-phrase; line-break: strict;
  }
  h1,h2,h3{ font-weight:800; letter-spacing:-0.038em; line-height:1.04; text-wrap:balance; margin:0 }
  p{ text-wrap:pretty; margin:0 }
  a{ color:inherit; text-decoration:none }
  code,kbd,pre{ font-family:"JetBrains Mono", ui-monospace, monospace }
  ::selection{ background: oklch(0.52 0.17 256 / 0.22) }
  :focus-visible{ outline:2px solid var(--primary); outline-offset:2px; border-radius:3px }

  /* スクロール進捗の細い風の線（装飾。JS無効なら scaleX(0) のまま不可視） */
  .progressbar{ position:fixed; inset:0 0 auto 0; height:2px; z-index:50; transform:scaleX(0);
    transform-origin:0 50%; background:linear-gradient(90deg, var(--primary), var(--cyan)); }

  .wrap{ width:100%; max-width:1140px; margin-inline:auto; padding-inline:clamp(1.25rem,4vw,2.25rem) }
  .section{ padding-block:clamp(4.5rem,3rem + 6vw,8.5rem) }
  .measure{ max-width:62ch }
  .lead{ font-size:clamp(1.1rem,1rem + .6vw,1.4rem); line-height:1.55; color:var(--muted) }
  .h-sec{ font-size:clamp(2rem,1.3rem + 2.7vw,3.35rem); letter-spacing:-0.04em }
  .eyetag{ display:inline-flex; align-items:center; gap:.5rem; font-family:"JetBrains Mono",monospace;
    font-size:.74rem; letter-spacing:.05em; padding:.4rem .7rem; border-radius:99px; }
  .kicker{ font-family:"JetBrains Mono",monospace; font-size:.76rem; letter-spacing:.12em; text-transform:uppercase;
    color:var(--primary-strong); font-weight:600 }

  /* 嵐バンド。ヒーロー・速度・フッターに前線のように差し込む。 */
  .storm{ background:
    radial-gradient(80% 90% at 88% -20%, var(--storm-2), transparent 55%),
    radial-gradient(60% 70% at 12% 120%, oklch(0.3 0.06 262 / 0.6), transparent 60%),
    var(--storm);
    color:var(--on-storm); position:relative; overflow:hidden; isolation:isolate;
  }
  .wind-canvas{ position:absolute; inset:0; width:100%; height:100%; z-index:0; pointer-events:none;
    mask-image: linear-gradient(90deg, transparent 0%, transparent 58%, #000 78%, #000 97%, transparent 100%);
  }
  .storm__scrim{ position:absolute; inset:0; z-index:0; pointer-events:none;
    background:linear-gradient(94deg, oklch(0.16 0.035 264 / 0.9) 0%, oklch(0.16 0.035 264 / 0.55) 50%, transparent 78%); }
  /* ヒーロー背後の巨大な透かし「野分」。視差で流れる。 */
  .watermark{ position:absolute; z-index:0; right:clamp(-3rem,-4vw,-1rem); top:50%; translate:0 -50%;
    font-weight:800; font-size:min(48vw,40rem); line-height:.8; letter-spacing:-0.04em;
    color:oklch(1 0 0 / 0.038); pointer-events:none; user-select:none; white-space:nowrap }
  .z1{ position:relative; z-index:1 }
  .hero-title{ font-size:clamp(2.85rem,1.5rem + 6.6vw,5.6rem); letter-spacing:-0.044em; line-height:0.98 }
  .hero-title .mark{ color:var(--cyan) }
  .on-storm-muted{ color:var(--on-storm-muted) }
  .lang a{ color:var(--on-storm-muted) }
  .lang a[aria-current="true"]{ color:var(--on-storm); font-weight:600 }

  /* 導入モーションで隠すのはヒーローだけ（折り返し以降は常時表示） */
  .anim [data-hero] [data-reveal], .anim [data-hero-title] > span{ opacity:0 }

  .copybar{ display:inline-flex; align-items:center; gap:.7rem; width:100%;
    padding:.95rem 1.05rem; border-radius:.75rem; border:1px solid oklch(0.72 0.05 256 / 0.3);
    background: oklch(1 0 0 / 0.05); color:var(--on-storm); font:inherit; cursor:pointer; text-align:left;
    transition:border-color .25s var(--ease), background .25s var(--ease), transform .25s var(--ease);
  }
  .copybar:hover{ border-color: oklch(0.8 0.12 256 / 0.6); background: oklch(1 0 0 / 0.09); transform:translateY(-1px) }
  .copybar:active{ transform:translateY(0) }
  .copybar:focus-visible{ outline:2px solid var(--cyan); outline-offset:2px }
  .copybar--primary{ background: oklch(0.52 0.17 256 / 0.22); border-color: oklch(0.82 0.12 256 / 0.7) }
  .copybar--primary:hover{ background: oklch(0.52 0.17 256 / 0.32) }
  .copybar__prompt{ color:var(--cyan); font-family:"JetBrains Mono",monospace }
  .copybar__cmd{ flex:1; font-size:.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .copybar__state{ font-size:.7rem; letter-spacing:.09em; text-transform:uppercase; color:var(--on-storm-muted) }

  /* 風のマーキー（キーワードが読み方向に流れる） */
  .marquee{ overflow:hidden; border-block:1px solid var(--line); background:var(--surface) }
  .marquee__track{ display:inline-flex; align-items:center; white-space:nowrap; padding-block:1.05rem; will-change:transform }
  .marquee__item{ display:inline-flex; align-items:center; gap:2.6rem; padding-inline:1.3rem;
    font-family:"JetBrains Mono",monospace; font-size:.92rem; letter-spacing:.01em; color:var(--muted) }
  .marquee__item b{ color:var(--ink); font-weight:600 }
  .marquee__dot{ color:var(--primary) }

  .code{ background:var(--storm); color:var(--on-storm); border-radius:1rem; padding:1.4rem 1.6rem; overflow:auto;
    font-size:.86rem; line-height:1.75; margin:0; tab-size:2; border:1px solid oklch(1 0 0 / 0.08) }
  .code .k{ color:#c7adff } .code .s{ color:#9fe3b6 } .code .c{ color:oklch(0.68 0.02 256) }
  .code .f{ color:var(--cyan) } .code .a{ color:#ffc08a }

  .link-u{ color:var(--primary-strong); text-decoration:underline; text-underline-offset:3px; text-decoration-thickness:1px }
  .link-u:hover{ text-decoration-thickness:2px }

  /* 本文中のインラインコード（明るいセクション）。pre.code とコピーバーは別扱い。 */
  p code{ color:var(--ink); font-weight:560; font-size:.94em }
  .lead code{ color:var(--ink); font-weight:560 }

  /* ship: バンドルサイズの棒（scaleX で伸ばす。transform-origin は左） */
  .bar-row{ display:grid; grid-template-columns:1fr; gap:.5rem; padding-block:1.25rem; border-top:1px solid var(--line) }
  .bar-row:last-child{ border-bottom:1px solid var(--line) }
  .bar-top{ display:flex; align-items:baseline; justify-content:space-between; gap:1rem }
  .bar-label{ color:var(--ink); font-weight:550 }
  .bar-val{ font-family:"JetBrains Mono",monospace; font-weight:700; font-size:1.1rem; letter-spacing:-0.01em }
  .bar-track{ height:.85rem; border-radius:99px; background:var(--surface); border:1px solid var(--line); overflow:hidden }
  .bar-fill{ height:100%; border-radius:99px; transform-origin:left center;
    background:linear-gradient(90deg, var(--primary), var(--primary-strong)) }
  .bar-fill--accent{ background:linear-gradient(90deg, var(--ember), var(--ember-strong)) }
  .bar-fill--muted{ background:oklch(0.74 0.02 258) }

  /* compare: テーブル */
  .ctable{ width:100%; border-collapse:collapse; font-size:.95rem }
  .ctable th, .ctable td{ text-align:left; padding:1rem 1.05rem; border-top:1px solid var(--line); vertical-align:top }
  .ctable thead th{ border-top:0; font-family:"JetBrains Mono",monospace; font-size:.78rem; letter-spacing:.04em;
    text-transform:uppercase; color:var(--muted); font-weight:600 }
  .ctable thead th:first-child{ color:transparent }
  .ctable td:first-child, .ctable th:first-child{ color:var(--muted) }
  .ctable col.col-nowaki{ background:oklch(0.52 0.17 256 / 0.06) }
  .ctable th.is-nowaki, .ctable td.is-nowaki{ color:var(--ink); font-weight:600 }
  .ctable th.is-nowaki{ color:var(--primary-strong) }
  .ctable-scroll{ overflow-x:auto; margin-top:1.6rem; border-radius:.9rem; border:1px solid var(--line) }
  .ctable td, .ctable th{ min-width:9rem }
  .ctable td:first-child, .ctable th:first-child{ min-width:13rem }
  /* Jetstream の差別化行を立てる */
  .ctable tr.is-jet td, .ctable tr.is-jet th{ background:oklch(0.87 0.1 228 / 0.10) }
  .ctable tr.is-jet th[scope=row]{ color:var(--ink); font-weight:700 }
  .jet-tag{ display:inline-block; margin-top:.4rem; font-family:"JetBrains Mono",monospace; font-size:.64rem;
    letter-spacing:.05em; text-transform:uppercase; color:var(--primary-strong);
    border:1px solid var(--line-strong); border-radius:999px; padding:.08rem .5rem }
  .jet-only{ margin-top:1.6rem; border:1px solid var(--line-strong); border-left:3px solid var(--cyan);
    border-radius:.9rem; background:var(--surface); padding:1.2rem 1.4rem; max-width:64ch }
  .jet-only b{ color:var(--ink) }

  .pcol h3{ font-size:1rem; font-family:"JetBrains Mono",monospace; letter-spacing:.02em }
  .pcol ul{ margin-top:.9rem; list-style:none; padding:0; display:flex; flex-direction:column; gap:.7rem }
  .pcol li{ display:flex; gap:.7rem; align-items:baseline; color:var(--muted) }

  @media (prefers-reduced-motion: reduce){
    html{ scroll-behavior:auto }
    .anim [data-hero] [data-reveal], .anim [data-hero-title] > span{ opacity:1 }
  }
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
