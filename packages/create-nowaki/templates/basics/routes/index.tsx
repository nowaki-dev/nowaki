import type { PageProps } from "@nowaki-dev/runtime";
import Counter from "../islands/Counter.tsx";

const CSS = `
:root{--ink:#10151c;--muted:#56616f;--line:#e7e9ee;--bg:#fbfcfd;--cyan:#0e7c86;--cyan-soft:#e9f4f5}
*{box-sizing:border-box}
body{margin:0;color:var(--ink);background:var(--bg);font:16px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;background-image:radial-gradient(70% 55% at 50% -8%, #eaf5f6 0%, transparent 70%)}
.wrap{max-width:46rem;margin:0 auto;padding:clamp(3.5rem,8vw,7rem) 1.5rem}
.brand{display:inline-flex;align-items:baseline;gap:.5rem;font-weight:800;letter-spacing:-0.03em;font-size:1.15rem}
.brand small{font-weight:500;color:var(--muted);font-size:.8rem}
.badge{display:inline-block;margin-top:2.2rem;font-size:.72rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--cyan);background:var(--cyan-soft);border:1px solid #cfe7e9;border-radius:999px;padding:.25rem .7rem}
h1{font-size:clamp(2.1rem,1.3rem + 3vw,3rem);letter-spacing:-0.035em;line-height:1.05;margin:1rem 0 0}
.lead{color:var(--muted);font-size:1.15rem;margin:.9rem 0 0;max-width:34rem}
.card{margin-top:2.2rem;border:1px solid var(--line);border-radius:16px;background:#fff;padding:1.4rem 1.6rem;box-shadow:0 1px 2px rgba(16,21,28,.04),0 14px 34px -20px rgba(16,21,28,.22)}
.card__label{font-size:.72rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.counter{margin-top:.9rem;display:inline-flex;align-items:center;gap:1rem}
.counter__btn{width:2.4rem;height:2.4rem;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:1.3rem;line-height:1;cursor:pointer;color:var(--ink);transition:border-color .15s,color .15s,background .15s}
.counter__btn:hover{border-color:var(--cyan);color:var(--cyan);background:var(--cyan-soft)}
.counter__value{font-size:1.5rem;font-variant-numeric:tabular-nums;min-width:2.6rem;text-align:center}
.note{margin:.9rem 0 0;color:var(--muted);font-size:.92rem}
.grid{margin-top:2.4rem;display:grid;gap:.8rem;grid-template-columns:1fr 1fr}
.tile{border:1px solid var(--line);border-radius:12px;padding:.85rem 1rem;background:#fff}
.tile code{font:.85rem ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--cyan)}
.tile span{display:block;color:var(--muted);font-size:.85rem;margin-top:.25rem}
.foot{margin-top:2.6rem;color:var(--muted);font-size:.92rem}
a{color:var(--cyan);text-decoration:none;font-weight:500}
a:hover{text-decoration:underline}
@media(max-width:520px){.grid{grid-template-columns:1fr}}
`;

export const title = "Nowaki app";
export const head = `<style>${CSS}</style>`;

export const loader = async () => ({ greeting: "Welcome to Nowaki" });

export default function Home({ data }: PageProps<typeof loader>) {
  return (
    <main class="wrap">
      <div class="brand">
        Nowaki <small>野分</small>
      </div>

      <span class="badge">basics template</span>
      <h1>{data.greeting} 🌀</h1>
      <p class="lead">
        Full-stack, yet zero JavaScript by default. The counter below is the only{" "}
        <strong>island</strong> that hydrates on the client.
      </p>

      <div class="card">
        <div class="card__label">island · the only JS on this page</div>
        <Counter start={0} />
        <p class="note">Everything else is server-rendered HTML.</p>
      </div>

      <div class="grid">
        <div class="tile">
          <code>routes/index.tsx</code>
          <span>This page. Edit it to get started.</span>
        </div>
        <div class="tile">
          <code>islands/Counter.tsx</code>
          <span>The interactive island that hydrates.</span>
        </div>
      </div>

      <p class="foot">
        Read the docs → <a href="https://nowaki.dev/docs">nowaki.dev/docs</a>
      </p>
    </main>
  );
}
