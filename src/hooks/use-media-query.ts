import { useCallback, useSyncExternalStore } from 'react';

/**
 * Observa uma media query sem depender de estado global.
 * O snapshot síncrono evita um primeiro frame com o layout errado no desktop.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
