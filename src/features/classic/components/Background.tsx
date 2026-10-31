import { useEffect, useRef } from 'react';

export function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }[] = [];
    let width = 0;
    let height = 0;
    let animId = 0;
    let running = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const compact = window.matchMedia('(max-width: 47.999rem)').matches;
      const count = Math.max(
        12,
        Math.min(54, Math.floor((width * height / 18000) * (compact ? 0.65 : 1))),
      );
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.5 + 0.1,
        });
      }
      draw();
    };

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      // Draw nearby connections without allocating a sliced array per particle.
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < 14400) {
            const dist = Math.sqrt(distanceSquared);
            ctx.strokeStyle = `rgba(0, 245, 255, ${0.04 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 245, 255, ${p.opacity})`;
        ctx.fill();

      }
    }

    const tick = () => {
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      });
      draw();
      animId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || document.hidden || reducedMotion.matches) return;
      running = true;
      animId = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(animId);
    };
    const visibilityChange = () => document.hidden ? stop() : start();
    const motionChange = () => reducedMotion.matches ? (stop(), draw()) : start();

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibilityChange);
    reducedMotion.addEventListener('change', motionChange);

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibilityChange);
      reducedMotion.removeEventListener('change', motionChange);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {/* Deep space base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, #071428 0%, #020d1a 40%, #010812 70%, #000508 100%)',
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 245, 255, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 245, 255, 0.025) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Ambient glow blobs */}
      <div
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, rgba(0, 245, 255, 0.4) 0%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'translateY(-30%)',
        }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'translateY(30%)',
        }}
      />
      <div
        className="absolute top-1/2 left-0 w-64 h-64 rounded-full opacity-8"
        style={{
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Corner accent lines */}
      <div
        className="absolute top-0 left-0 w-48 h-48 opacity-30"
        style={{
          background:
            'linear-gradient(135deg, rgba(0,245,255,0.3) 0%, rgba(0,245,255,0.05) 50%, transparent 100%)',
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-48 h-48 opacity-30"
        style={{
          background:
            'linear-gradient(-45deg, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0.05) 50%, transparent 100%)',
        }}
      />

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-60"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
}
