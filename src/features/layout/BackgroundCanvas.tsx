import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  violet: boolean;
}

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let running = false;

    const draw = () => {
      context.clearRect(0, 0, width, height);

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];

        for (let other = index + 1; other < particles.length; other += 1) {
          const neighbor = particles[other];
          const dx = particle.x - neighbor.x;
          const dy = particle.y - neighbor.y;
          const distance = Math.hypot(dx, dy);

          if (distance < 120) {
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(neighbor.x, neighbor.y);
            context.strokeStyle = `rgba(0, 229, 255, ${0.055 * (1 - distance / 120)})`;
            context.lineWidth = 0.6;
            context.stroke();
          }
        }

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = particle.violet
          ? `rgba(167, 139, 250, ${particle.alpha})`
          : `rgba(0, 229, 255, ${particle.alpha})`;
        context.fill();
      }
    };

    const createParticles = () => {
      const count = Math.min(54, Math.max(18, Math.floor(width / 26)));

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        radius: 0.6 + Math.random() * 1.4,
        alpha: 0.18 + Math.random() * 0.35,
        violet: Math.random() > 0.82,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      createParticles();
      draw();
    };

    const tick = () => {
      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;
      }

      draw();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || reducedMotion.matches) {
        return;
      }

      running = true;
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    const handleMotionPreference = () => {
      if (reducedMotion.matches) {
        stop();
        draw();
      } else {
        start();
      }
    };

    resize();
    start();

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);
    reducedMotion.addEventListener('change', handleMotionPreference);

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
      reducedMotion.removeEventListener('change', handleMotionPreference);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
      aria-hidden="true"
    />
  );
}
