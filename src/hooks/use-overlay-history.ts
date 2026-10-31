import { useCallback, useEffect, useRef } from 'react';

const OVERLAY_KEY = '__nexaOverlay';

/** Mirrors a transient mobile layer in browser history so Back dismisses it first. */
export function useOverlayHistory(
  open: boolean,
  setOpen: (open: boolean) => void,
  id: string,
) {
  const pushed = useRef(false);

  const close = useCallback(() => {
    if (pushed.current && (window.history.state as Record<string, unknown> | null)?.[OVERLAY_KEY] === id) {
      window.history.back();
      return;
    }
    pushed.current = false;
    setOpen(false);
  }, [id, setOpen]);

  useEffect(() => {
    if (!open || pushed.current) return;
    window.history.pushState({ ...(window.history.state ?? {}), [OVERLAY_KEY]: id }, '');
    pushed.current = true;
  }, [id, open]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const currentId = (event.state as Record<string, unknown> | null)?.[OVERLAY_KEY];
      const isThisOverlay = currentId === id;
      pushed.current = isThisOverlay;
      setOpen(isThisOverlay);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) close();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, id, open, setOpen]);

  return close;
}
