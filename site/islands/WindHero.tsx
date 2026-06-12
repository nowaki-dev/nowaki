import { useEffect, useRef } from "preact/hooks";

// 野分（風）を表す生成ビジュアル。ストーム帯の上を、嵐の青の筋が流れる。
// reduced-motion 時はアニメーションせず、静止した一枚を描く。
export default function WindHero() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * DPR));
      canvas.height = Math.max(1, Math.floor(h * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    type Streak = { x: number; y: number; len: number; speed: number; alpha: number };
    const spawn = (offLeft = false): Streak => ({
      x: offLeft ? -Math.random() * 240 : Math.random() * w,
      y: Math.random() * h,
      len: 50 + Math.random() * 220,
      speed: 1.4 + Math.random() * 4.2,
      alpha: 0.04 + Math.random() * 0.32,
    });

    const drawStreak = (s: Streak) => {
      const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.len, s.y);
      grad.addColorStop(0, "rgba(140, 205, 255, 0)");
      grad.addColorStop(0.5, `rgba(150, 210, 255, ${s.alpha})`);
      grad.addColorStop(1, "rgba(140, 205, 255, 0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.len, s.y);
      ctx.stroke();
    };

    resize();
    addEventListener("resize", resize, { passive: true });

    const streaks = Array.from({ length: reduce ? 40 : 110 }, () => spawn());

    if (reduce) {
      ctx.clearRect(0, 0, w, h);
      for (const s of streaks) drawStreak(s);
    } else {
      const frame = () => {
        ctx.clearRect(0, 0, w, h);
        for (const s of streaks) {
          drawStreak(s);
          s.x += s.speed;
          if (s.x > w + 60) Object.assign(s, spawn(true));
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} class="wind-canvas" aria-hidden="true" />;
}
