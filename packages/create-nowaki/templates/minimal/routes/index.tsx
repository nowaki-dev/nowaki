const CSS = `
:root{--ink:#10151c;--muted:#56616f;--line:#e7e9ee;--bg:#fbfcfd;--cyan:#0e7c86;--cyan-soft:#e9f4f5}
*{box-sizing:border-box}
body{margin:0;color:var(--ink);background:var(--bg);font:16px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;background-image:radial-gradient(70% 55% at 50% -8%, #eaf5f6 0%, transparent 70%)}
.wrap{max-width:42rem;margin:0 auto;padding:clamp(4rem,10vw,8rem) 1.5rem}
.brand{display:inline-flex;align-items:baseline;gap:.5rem;font-weight:800;letter-spacing:-0.03em;font-size:1.15rem}
.brand small{font-weight:500;color:var(--muted);font-size:.8rem}
.badge{display:inline-block;margin-top:2.2rem;font-size:.72rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--cyan);background:var(--cyan-soft);border:1px solid #cfe7e9;border-radius:999px;padding:.25rem .7rem}
h1{font-size:clamp(2.1rem,1.3rem + 3vw,3rem);letter-spacing:-0.035em;line-height:1.05;margin:1rem 0 0}
.lead{color:var(--muted);font-size:1.15rem;margin:.9rem 0 0;max-width:32rem}
p code{font:.9em ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--cyan);background:#eef2f3;padding:.1em .4em;border-radius:5px}
.foot{margin-top:2.6rem;color:var(--muted);font-size:.92rem}
a{color:var(--cyan);text-decoration:none;font-weight:500}
a:hover{text-decoration:underline}
`;

export const title = "Nowaki";
export const head = `<style>${CSS}</style>`;

export default function Home() {
  return (
    <main class="wrap">
      <div class="brand">
        Nowaki <small>野分</small>
      </div>

      <span class="badge">minimal template</span>
      <h1>Hello, Nowaki 🌀</h1>
      <p class="lead">
        This page is server-rendered HTML and ships <strong>zero JavaScript</strong>.
      </p>
      <p style="color:var(--muted);margin-top:1rem">
        Edit <code>routes/index.tsx</code> to get started. Add interactive components under{" "}
        <code>islands/</code> when you need them.
      </p>

      <p class="foot">
        Read the docs → <a href="https://nowaki.dev/docs">nowaki.dev/docs</a>
      </p>
    </main>
  );
}
