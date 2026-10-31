import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useUiStore } from '@/stores/ui-store';

import { SessionsSidebar } from '@/features/chat/SessionsSidebar';

export function SessionsSheet() {
  const open = useUiStore((state) => state.sessionsSheetOpen);
  const setOpen = useUiStore((state) => state.setSessionsSheetOpen);
  const dialogRef = useRef<HTMLDialogElement>(null);

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
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div className="flex h-full flex-col bg-background/95 backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <span className="font-display text-[11px] tracking-[0.24em] text-primary">NEXA</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar conversas"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted transition hover:border-primary/30 hover:text-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <SessionsSidebar onSelect={() => setOpen(false)} className="min-h-0 flex-1" />
      </div>
    </dialog>
  );
}
