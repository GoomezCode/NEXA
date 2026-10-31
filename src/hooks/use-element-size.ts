import { useEffect, useRef, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/** Measures an element without coupling layout to window resize events. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((current) => current.width === width && current.height === height ? current : { width, height });
      element.style.setProperty('--element-width', `${width}px`);
      element.style.setProperty('--element-height', `${height}px`);
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      element.style.removeProperty('--element-width');
      element.style.removeProperty('--element-height');
    };
  }, []);

  return { ref, ...size };
}
