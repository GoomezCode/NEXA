import { useEffect } from 'react';

import { useUiStore } from '@/stores/ui-store';

export function focusComposer(): void {
  const composer = document.getElementById('nexa-composer');

  if (composer instanceof HTMLTextAreaElement) {
    composer.focus();
    const end = composer.value.length;
    composer.setSelectionRange(end, end);
  }
}

export function useGlobalShortcuts(): void {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        focusComposer();
        return;
      }

      if (modifier && !event.altKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebar();
        return;
      }

      if (event.key === 'Escape') {
        const state = useUiStore.getState();

        if (state.sessionsSheetOpen) {
          state.setSessionsSheetOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);
}
