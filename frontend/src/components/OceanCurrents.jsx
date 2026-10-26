import { useEffect, useRef } from 'react';
import './OceanCurrents.css';

export default function OceanCurrents() {
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    // Skip if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    const dpr = window.devicePixelRatio || 1;
    const WAVE_W = 140; // canvas width in CSS px
    const WAVES_COUNT = 5;

    // Each wave has its own parameters + particles
    const waves = Array.from({ length: WAVES_COUNT }, (_, i) => ({
      offset: (i / WAVES_COUNT) * Math.PI * 2,
      amplitude: 10 + i * 4,
      frequency: 0.007 + i * 0.0012,
      speed: 0.35 + i * 0.09,
      baseOffset: 22 + i * 16,
      particles: Array.from({ length: 5 }, () => ({
        y: Math.random(),
        speed: 0.4 + Math.random() * 0.5,
        size: 1.2 + Math.random() * 1.2,
      })),
    }));

    // State
    let animTime = 0;
    let scrollOffset = 0;
    let lastScrollY = window.scrollY;
    let rafId;

    const resize = () => {
      const h = window.innerHeight;
      [left, right].forEach((c) => {
        c.width = WAVE_W * dpr;
        c.height = h * dpr;
        c.style.width = WAVE_W + 'px';
        c.style.height = h + 'px';
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      });
    };
    resize();
    window.addEventListener('resize', resize);

    const drawSide = (canvas, mirror) => {
      const ctx = canvas.getContext('2d');
      const w = WAVE_W;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const rgb = isDark ? '56, 189, 248' : '2, 132, 199';
      const rgbBright = isDark ? '125, 211, 252' : '56, 189, 248';

      const scrollPhase = scrollOffset * 0.0025;

      waves.forEach((wave, wi) => {
        const phase = animTime * wave.speed + wave.offset + scrollPhase;
        const baseX = mirror ? w - wave.baseOffset : wave.baseOffset;

        // Draw the wave line
        ctx.beginPath();
        const alpha = 0.06 + wi * 0.018;
        ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
        ctx.lineWidth = 1;

        for (let y = -20; y <= h + 20; y += 3) {
          const x = baseX + Math.sin(y * wave.frequency + phase) * wave.amplitude;
          if (y === -20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw particles flowing along the wave
        wave.particles.forEach((p) => {
          // Flow down naturally + react to scroll
          p.y += (p.speed * 0.0015) + (scrollPhase === 0 ? 0 : 0);
          // Advance by frame time + scroll contribution
          p.y += wave.speed * 0.0009;
          if (p.y > 1) p.y -= 1;
          if (p.y < 0) p.y += 1;

          const py = p.y * h;
          const px = baseX + Math.sin(py * wave.frequency + phase) * wave.amplitude;

          // Glow
          const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 4);
          grad.addColorStop(0, `rgba(${rgbBright}, 0.6)`);
          grad.addColorStop(1, `rgba(${rgbBright}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 4, 0, Math.PI * 2);
          ctx.fill();

          // Dot
          ctx.fillStyle = `rgba(${rgbBright}, 0.8)`;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    };

    const tick = () => {
      animTime += 0.016;

      // Track scroll (delta accumulates — smooths out per-frame)
      const curY = window.scrollY;
      const delta = curY - lastScrollY;
      scrollOffset += delta;
      lastScrollY = curY;

      // Slight decay so scroll phase doesn't run away forever
      scrollOffset *= 0.998;

      drawSide(left, false);
      drawSide(right, true);

      rafId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas ref={leftRef} className="ocean-currents ocean-currents-left" aria-hidden="true" />
      <canvas ref={rightRef} className="ocean-currents ocean-currents-right" aria-hidden="true" />
    </>
  );
}