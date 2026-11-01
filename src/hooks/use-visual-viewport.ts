import { useEffect } from 'react';

/** Keeps the app surface aligned with the visible browser area, including the on-screen keyboard. */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let frame = 0;
    let baselineHeight = window.innerHeight;
    let baselineWidth = window.innerWidth;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const height = `${viewport.height}px`;
        const top = `${viewport.offsetTop}px`;
        const keyboardInset = Math.max(0, baselineHeight - viewport.height - viewport.offsetTop);
        const root = document.documentElement;
        if (root.style.getPropertyValue('--visual-viewport-height') !== height) {
          root.style.setProperty('--visual-viewport-height', height);
        }
        if (root.style.getPropertyValue('--visual-viewport-top') !== top) {
          root.style.setProperty('--visual-viewport-top', top);
        }
        root.style.setProperty('--kb-inset', `${keyboardInset}px`);
        root.dataset.keyboard = keyboardInset > 120 ? 'open' : 'closed';
      });
    };
    const resetBaseline = () => {
      baselineHeight = window.innerHeight;
      baselineWidth = window.innerWidth;
      update();
    };
    const handleWindowResize = () => {
      // A width change indicates a real viewport/orientation change, not a keyboard.
      if (window.innerWidth !== baselineWidth && document.documentElement.dataset.keyboard !== 'open') {
        resetBaseline();
      } else {
        update();
      }
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', resetBaseline);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', resetBaseline);
      document.documentElement.style.removeProperty('--visual-viewport-height');
      document.documentElement.style.removeProperty('--visual-viewport-top');
      document.documentElement.style.removeProperty('--kb-inset');
      delete document.documentElement.dataset.keyboard;
    };
  }, []);
}
