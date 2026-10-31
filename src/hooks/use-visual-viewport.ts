import { useEffect } from 'react';

/** Keeps the app surface aligned with the visible browser area, including the on-screen keyboard. */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const root = document.documentElement;
      root.style.setProperty('--visual-viewport-height', `${viewport.height}px`);
      root.style.setProperty('--visual-viewport-top', `${viewport.offsetTop}px`);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--visual-viewport-height');
      document.documentElement.style.removeProperty('--visual-viewport-top');
    };
  }, []);
}
