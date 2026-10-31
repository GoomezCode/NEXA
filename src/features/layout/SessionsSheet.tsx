import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useRef } from 'react';

import { SessionsSidebar } from '@/features/chat/SessionsSidebar';

export function SessionsSheet() {
  const [searchParams, setSearchParams] = useSearchParams();
  const touchStartX = useRef<number | null>(null);
  const open = searchParams.get('panel') === 'sessions';
  const setOpen = (nextOpen: boolean) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextOpen) next.set('panel', 'sessions');
      else if (next.get('panel') === 'sessions') next.delete('panel');
      return next;
    }, { replace: !nextOpen });
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[79] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="nexa-sheet fixed inset-0 z-[80] flex flex-col bg-background/95 pb-[var(--safe-bottom)] pt-[var(--safe-top)] shadow-2xl backdrop-blur-2xl"
          onCloseAutoFocus={(event) => {
            if (!document.getElementById('open-sessions-button')) return;
            event.preventDefault();
            document.getElementById('open-sessions-button')?.focus();
          }}
        >
          <header
            className="flex min-h-14 items-center justify-between border-b border-border/60 px-4 py-3"
            onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              const startX = touchStartX.current;
              const endX = event.changedTouches[0]?.clientX;
              if (startX !== null && endX !== undefined && startX - endX > 48) setOpen(false);
              touchStartX.current = null;
            }}
          >
            <Dialog.Title className="font-display text-2xs tracking-[0.24em] text-primary">NEXA · Conversas</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar conversas"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-foreground/5 text-muted transition hover:border-primary/30 hover:text-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>
          <SessionsSidebar onSelect={() => setOpen(false)} className="min-h-0 flex-1" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
