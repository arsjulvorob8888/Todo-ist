import { useEffect, useRef } from "react";

type Bit = { x: number; y: number; vx: number; vy: number; life: number; color: string; w: number };

export function Burst({ nonce }: { nonce: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bits = useRef<Bit[]>([]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bits.current = bits.current.filter((bit) => bit.life > 0);
      for (const bit of bits.current) {
        bit.x += bit.vx;
        bit.y += bit.vy;
        bit.vy += 0.12;
        bit.life -= 0.012;
        ctx.globalAlpha = Math.max(0, bit.life);
        ctx.fillStyle = bit.color;
        ctx.fillRect(bit.x, bit.y, bit.w, bit.w * 0.55);
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    if (!nonce) return;
    const canvas = ref.current;
    if (!canvas) return;
    const colors = ["#e8a317", "#f6d27a", "#ef5d32", "#f4efe6"];
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.38;
    for (let i = 0; i < 140; i += 1) {
      const angle = (Math.PI * 2 * i) / 140 + Math.random();
      const speed = 4 + Math.random() * 9;
      bits.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 1,
        color: colors[i % colors.length] ?? "#e8a317",
        w: 7 + Math.random() * 8,
      });
    }
  }, [nonce]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-40" aria-hidden="true" />;
}
