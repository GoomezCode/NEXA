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
    let compact = false;
    let lastFrameAt = 0;
    let resizeTimer = 0;

    const draw = () => {
      context.clearRect(0, 0, width, height);

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];

        for (let other = index + 1; other < particles.length; other += 1) {
          const neighbor = particles[other];
          const dx = particle.x - neighbor.x;
          const dy = particle.y - neighbor.y;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared < 14400) {
            const distance = Math.sqrt(distanceSquared);
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
      compact = window.matchMedia('(max-width: 47.999rem), (pointer: coarse)').matches;
      const areaCount = Math.floor((width * height) / 18000);
      const count = Math.max(10, Math.min(compact ? 20 : 54, Math.floor(areaCount * (compact ? 0.55 : 1))));

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
      const compact = window.matchMedia('(max-width: 47.999rem), (pointer: coarse)').matches;
      const dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2);

      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      createParticles();
      draw();
    };

    const tick = (timestamp: number) => {
      const frameInterval = compact ? 1000 / 30 : 1000 / 45;
      if (timestamp - lastFrameAt >= frameInterval) {
        const delta = lastFrameAt ? Math.min((timestamp - lastFrameAt) / (1000 / 60), 2) : 1;
        lastFrameAt = timestamp;

        for (const particle of particles) {
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;

          if (particle.x < -10) particle.x = width + 10;
          if (particle.x > width + 10) particle.x = -10;
          if (particle.y < -10) particle.y = height + 10;
          if (particle.y > height + 10) particle.y = -10;
        }

        draw();
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || reducedMotion.matches || document.documentElement.dataset.reducedMotion === 'true') {
        return;
      }

      running = true;
      lastFrameAt = 0;
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
      if (reducedMotion.matches || document.documentElement.dataset.reducedMotion === 'true') {
        stop();
        draw();
      } else {
        start();
      }
    };

    resize();
    start();

    const scheduleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 120);
    };
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(canvas);
    window.addEventListener('resize', scheduleResize);
    document.addEventListener('visibilitychange', handleVisibility);
    reducedMotion.addEventListener('change', handleMotionPreference);
    const motionObserver = new MutationObserver(handleMotionPreference);
    motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] });

    return () => {
      stop();
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      reducedMotion.removeEventListener('change', handleMotionPreference);
      motionObserver.disconnect();
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
