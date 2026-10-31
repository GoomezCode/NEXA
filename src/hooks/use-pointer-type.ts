import { useEffect, useState } from 'react';

export type PointerType = 'coarse' | 'fine' | 'none';

function readPointerType(): PointerType {
  if (typeof window === 'undefined') return 'none';
  if (window.matchMedia('(pointer: coarse)').matches) return 'coarse';
  if (window.matchMedia('(pointer: fine)').matches) return 'fine';
  return 'none';
}

/** Returns the primary pointer type and updates when a hybrid device changes its active mode. */
export function usePointerType(): PointerType {
  const [pointerType, setPointerType] = useState<PointerType>(readPointerType);

  useEffect(() => {
    const queries = [window.matchMedia('(pointer: coarse)'), window.matchMedia('(pointer: fine)')];
    const update = () => setPointerType(readPointerType());
    queries.forEach((query) => query.addEventListener('change', update));
    return () => queries.forEach((query) => query.removeEventListener('change', update));
  }, []);

  return pointerType;
}
