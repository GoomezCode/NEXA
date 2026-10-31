import { useEffect } from 'react';

/** Keeps the app surface aligned with the visible browser area, including the on-screen keyboard. */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const height = `${viewport.height}px`;
        const top = `${viewport.offsetTop}px`;
        const root = document.documentElement;
        if (root.style.getPropertyValue('--visual-viewport-height') !== height) {
          root.style.setProperty('--visual-viewport-height', height);
        }
        if (root.style.getPropertyValue('--visual-viewport-top') !== top) {
          root.style.setProperty('--visual-viewport-top', top);
        }
      });
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--visual-viewport-height');
      document.documentElement.style.removeProperty('--visual-viewport-top');
    };
  }, []);
}
