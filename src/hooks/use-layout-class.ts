import { useEffect, useState } from 'react';

export type LayoutClass = 'compact' | 'medium' | 'expanded';

function readLayout(): { layout: LayoutClass; short: boolean } {
  if (typeof window === 'undefined') return { layout: 'expanded', short: false };
  return {
    layout: window.matchMedia('(max-width: 47.999rem)').matches
      ? 'compact'
      : window.matchMedia('(max-width: 79.999rem)').matches
        ? 'medium'
        : 'expanded',
    short: window.matchMedia('(max-height: 32rem)').matches,
  };
}

/** Tracks structural layout changes without coupling persistent UI state to the layout tree. */
export function useLayoutClass() {
  const [layout, setLayout] = useState(readLayout);

  useEffect(() => {
    const queries = [
      window.matchMedia('(max-width: 47.999rem)'),
      window.matchMedia('(max-width: 79.999rem)'),
      window.matchMedia('(max-height: 32rem)'),
    ];
    const update = () => setLayout(readLayout());
    queries.forEach((query) => query.addEventListener('change', update));
    return () => queries.forEach((query) => query.removeEventListener('change', update));
  }, []);

  return layout;
}
