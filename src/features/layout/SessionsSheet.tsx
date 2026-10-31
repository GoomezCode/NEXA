import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useUiStore } from '@/stores/ui-store';
import { useOverlayHistory } from '@/hooks/use-overlay-history';

import { SessionsSidebar } from '@/features/chat/SessionsSidebar';

export function SessionsSheet() {
  const open = useUiStore((state) => state.sessionsSheetOpen);
  const setOpen = useUiStore((state) => state.setSessionsSheetOpen);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStartX = useRef<number | null>(null);
  const close = useOverlayHistory(open, setOpen, 'sessions');

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="nexa-sheet"
      aria-label="Conversas"
      onCancel={(event) => event.preventDefault()}
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
        <div className="flex h-full flex-col bg-background/95 pb-[var(--safe-bottom)] pt-[var(--safe-top)] backdrop-blur-2xl">
        <div className="flex min-h-14 items-center justify-between border-b border-white/5 px-4 py-3" onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const startX = touchStartX.current; const endX = event.changedTouches[0]?.clientX; if (startX !== null && endX !== undefined && startX - endX > 48) close(); touchStartX.current = null; }}>
          <span className="font-display text-2xs tracking-[0.24em] text-primary">NEXA</span>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar conversas"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted transition hover:border-primary/30 hover:text-primary active:scale-95"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <SessionsSidebar onSelect={close} className="min-h-0 flex-1" />
      </div>
    </dialog>
  );
}
