import { useEffect } from "preact/hooks";

// ページのモーションを束ねる「指揮役」の島。自分自身は何も描画しない。
// 外部ライブラリ不使用（WAAPI + IntersectionObserver + rAF だけ）。このサイトは
// 「最小JSを自分で証明する」のが第一原則なので、演出のために重い依存は載せない。
//
// 設計（impeccable / PRODUCT.md「風＝メッセージ」）:
// - 見せ場は1つ ＝ ヒーローの「風で吹き込むタイポ」。一律のフェードは撒かない。
// - 動かすのは意味のある所だけ: 送信JS量の棒、数値、本物の手順(3ステップ)、風のマーキー。
// - 隠すのはヒーローだけ（折り返し以降はJS到達前から見えている）。
// - prefers-reduced-motion では何もしない。
const EXPO = "cubic-bezier(0.16,1,0.3,1)";
const QUINT = "cubic-bezier(0.22,1,0.36,1)";

export default function Animator() {
  useEffect(() => {
    const root = document.documentElement;
    // reduced-motion（head が .anim を付けない）や、起動が遅れて保険が発火した場合は何もしない。
    if (!root.classList.contains("anim")) return;
    root.classList.add("anim-on"); // head 側の「保険で全表示」タイマを止める

    const ac = new AbortController();
    const { signal } = ac;
    const rafs: number[] = [];
    const observers: IntersectionObserver[] = [];
    const raf = (fn: FrameRequestCallback) => {
      const id = requestAnimationFrame(fn);
      rafs.push(id);
      return id;
    };

    // 要素が初めてビューに入ったら1回だけ実行
    const onEnter = (el: Element, fn: () => void, margin = "0px 0px -10% 0px") => {
      const io = new IntersectionObserver(
        (entries, obs) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              fn();
              obs.disconnect();
            }
          }
        },
        { rootMargin: margin },
      );
      io.observe(el);
      observers.push(io);
    };

    // ── 署名モーション: ヒーローのタイポが風で吹き込む ──────────────────
    const lines = Array.from(root.querySelectorAll<HTMLElement>("[data-hero-title] > span"));
    const rest = Array.from(root.querySelectorAll<HTMLElement>("[data-hero] [data-reveal]")).filter(
      (el) => !el.closest("[data-hero-title]"),
    );
    lines.forEach((el, i) => {
      el.animate(
        [
          { opacity: 0, transform: "translate(-8%,16px) skewX(6deg)", filter: "blur(14px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        { duration: 950, delay: 100 + i * 120, easing: EXPO, fill: "both" },
      );
    });
    const restBase = Math.max(0, 100 + lines.length * 120 - 250);
    rest.forEach((el, i) => {
      el.animate(
        [
          { opacity: 0, transform: "translateY(18px)", filter: "blur(8px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        { duration: 700, delay: restBase + i * 70, easing: EXPO, fill: "both" },
      );
    });

    // ── 本物の3ステップを読み方向(左→右)に順次出す ───────────────────
    const steps = document.querySelector<HTMLElement>("[data-steps]");
    if (steps) {
      const kids = Array.from(steps.children) as HTMLElement[];
      kids.forEach((el) => (el.style.opacity = "0")); // 折り返し下なので先に伏せる（チラ見え防止）
      onEnter(steps, () => {
        kids.forEach((el, i) => {
          el.animate(
            [
              { opacity: 0, transform: "translate(-4%,22px)", filter: "blur(6px)" },
              { opacity: 1, transform: "none", filter: "blur(0px)" },
            ],
            { duration: 700, delay: i * 120, easing: EXPO, fill: "both" },
          );
        });
      });
    }

    // ── 送信JS量の棒を伸ばす（width ではなく scaleX。レイアウトを動かさない） ──
    Array.from(document.querySelectorAll<HTMLElement>(".bar-fill")).forEach((el) => {
      el.style.transform = "scaleX(0)";
      onEnter(el, () => {
        el.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
          duration: 1100,
          easing: QUINT,
          fill: "both",
        });
      });
    });

    // ── 数字のカウントアップ（接頭/接尾を保ったまま数値だけ回す） ──────────
    Array.from(document.querySelectorAll<HTMLElement>("[data-countup]")).forEach((el) => {
      const raw = el.textContent || "";
      const m = raw.match(/[\d.]+/);
      if (!m) return;
      const target = parseFloat(m[0]);
      const dec = (m[0].split(".")[1] || "").length;
      el.textContent = raw.replace(m[0], (0).toFixed(dec)); // 先に0に（折り返し下なのでチラ見えしない）
      onEnter(el, () => {
        const dur = 1300;
        let start: number | null = null;
        const step = (t: number) => {
          if (start === null) start = t;
          const p = Math.min(1, (t - start) / dur);
          const eased = 1 - Math.pow(1 - p, 2); // easeOutQuad
          el.textContent = raw.replace(m[0], (target * eased).toFixed(dec));
          if (p < 1) raf(step);
        };
        raf(step);
      });
    });

    // ── 折り返し以降をスクロールで静かに立ち上げる ───────────────────
    // 見出し/本文は単体で rise、グリッドやリストは子を順に。距離は控えめ・blur で柔らかく。
    // 伏せるのは JS のみ（静的HTML/クローラ/JS無効では常に表示）。
    const riseKeys: Keyframe[] = [
      { opacity: 0, transform: "translateY(22px)", filter: "blur(6px)" },
      { opacity: 1, transform: "none", filter: "blur(0px)" },
    ];
    Array.from(document.querySelectorAll<HTMLElement>("[data-rise]")).forEach((el) => {
      el.style.opacity = "0";
      onEnter(el, () => {
        el.animate(riseKeys, { duration: 720, easing: EXPO, fill: "both" });
      });
    });
    Array.from(document.querySelectorAll<HTMLElement>("[data-rise-group]")).forEach((group) => {
      const kids = Array.from(group.children) as HTMLElement[];
      kids.forEach((el) => (el.style.opacity = "0"));
      onEnter(group, () => {
        kids.forEach((el, i) => {
          el.animate(
            [
              { opacity: 0, transform: "translateY(20px)", filter: "blur(5px)" },
              { opacity: 1, transform: "none", filter: "blur(0px)" },
            ],
            { duration: 640, delay: Math.min(i, 8) * 70, easing: EXPO, fill: "both" },
          );
        });
      });
    });

    // ── スクロール: 進捗バー + ヒーロー透かしの視差。風のマーキーへ突風も渡す ──
    const progress = document.querySelector<HTMLElement>("[data-progress]");
    const watermark = document.querySelector<HTMLElement>("[data-parallax]");
    const wmAmount = watermark ? parseFloat(watermark.dataset.parallax || "0.15") : 0;
    let scrollY = window.scrollY;
    let lastY = scrollY;
    let lastT = performance.now();
    let velo = 0;
    let ticking = false;
    const updateScroll = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? scrollY / max : 0;
      if (progress) progress.style.transform = `scaleX(${p})`;
      if (watermark) watermark.style.transform = `translateY(${scrollY * wmAmount}px)`;
    };
    const onScroll = () => {
      scrollY = window.scrollY;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      velo = (scrollY - lastY) / dt;
      lastY = scrollY;
      lastT = now;
      if (!ticking) {
        ticking = true;
        raf(updateScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true, signal });
    updateScroll();

    // ── 風のマーキー。スクロール速度で一瞬だけ加速する（突風）。視界外では止める。 ──
    const track = document.querySelector<HTMLElement>("[data-marquee]");
    if (track) {
      let half = track.scrollWidth / 2;
      let x = 0;
      let gust = 0;
      let visible = false;
      let running = false;
      const tick = () => {
        const targetGust = Math.min(3, Math.abs(velo) * 0.6);
        gust += (targetGust - gust) * 0.08;
        x -= 0.7 * (1 + gust * 2);
        if (x <= -half) x += half;
        track.style.transform = `translateX(${x}px)`;
        if (visible) {
          running = true;
          raf(tick);
        } else {
          running = false;
        }
      };
      const io = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible && !running) raf(tick);
      });
      io.observe(track.parentElement || track);
      observers.push(io);
      window.addEventListener(
        "resize",
        () => {
          half = track.scrollWidth / 2;
        },
        { passive: true, signal },
      );
    }

    return () => {
      ac.abort();
      rafs.forEach(cancelAnimationFrame);
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  return null;
}
