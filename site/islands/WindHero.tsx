import { useEffect, useRef } from "preact/hooks";

// 野分（風）を表す生成ビジュアル。ストーム帯の上を、嵐の青の筋が流れる。
// ポインタに反応する: カーソル付近で風が曲がり・加速し・明るくなる（風が応答する）。
// reduced-motion 時はアニメーションせず、静止した一枚を描く。タッチ端末では反応を付けない。
export default function WindHero() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
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

    type Streak = {
      x: number;
      y: number;
      len: number;
      speed: number;
      alpha: number;
      boost: number;
    };
    const spawn = (offLeft = false): Streak => ({
      x: offLeft ? -Math.random() * 240 : Math.random() * w,
      y: Math.random() * h,
      len: 50 + Math.random() * 220,
      speed: 1.4 + Math.random() * 4.2,
      alpha: 0.03 + Math.random() * 0.13,
      boost: 0,
    });

    const drawStreak = (s: Streak) => {
      const a = Math.min(0.42, s.alpha + s.boost * 0.28);
      const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.len, s.y);
      grad.addColorStop(0, "rgba(140, 205, 255, 0)");
      grad.addColorStop(0.5, `rgba(${150 + s.boost * 60}, 210, 255, ${a})`);
      grad.addColorStop(1, "rgba(140, 205, 255, 0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.25 + s.boost * 1.1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.len, s.y);
      ctx.stroke();
    };

    // ポインタ位置（canvas ローカル px）。離れている間は遠方に置く。
    let px = -9999;
    let py = -9999;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
    };
    const onLeave = () => {
      px = -9999;
      py = -9999;
    };

    resize();
    addEventListener("resize", resize, { passive: true });

    const streaks = Array.from({ length: reduce ? 30 : 80 }, () => spawn());

    if (reduce) {
      ctx.clearRect(0, 0, w, h);
      for (const s of streaks) drawStreak(s);
    } else {
      if (finePointer) {
        canvas.parentElement?.addEventListener("pointermove", onMove, { passive: true });
        canvas.parentElement?.addEventListener("pointerleave", onLeave, { passive: true });
      }
      const R = 175; // 反応半径
      const frame = () => {
        ctx.clearRect(0, 0, w, h);
        const active = px > -9000;
        for (const s of streaks) {
          if (active) {
            // 筋の中心とカーソルの距離で近接度 f を出す。
            const dx = s.x + s.len * 0.5 - px;
            const dy = s.y - py;
            const dist = Math.hypot(dx, dy);
            if (dist < R) {
              const f = 1 - dist / R;
              s.y += (py - s.y) * 0.045 * f; // カーソルの高さへ静かに引き寄せる（風が曲がる）
              s.x += s.speed * f * 1.7; // 近づくほど加速（突風）
              s.boost = Math.max(s.boost, f);
            }
          }
          s.boost *= 0.92; // 余韻を残して減衰
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
      canvas.parentElement?.removeEventListener("pointermove", onMove);
      canvas.parentElement?.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} class="wind-canvas" aria-hidden="true" />;
}
