import { useEffect, type ReactNode } from 'react';

import { ensureGuest } from '@/api/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useConnectionStore } from '@/stores/connection-store';

import { AuthView } from './AuthView';

const MAX_TIMEOUT = 2 ** 31 - 1;

export function AuthGate({ children }: { children: ReactNode }) {
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const session = useAuthStore((state) => state.session);
  const offline = useConnectionStore((state) => state.mode === 'offline');

  // Quando o token vence: convidado renova em silêncio; usuário/admin volta ao login.
  useEffect(() => {
    if (!session || offline) return;

    const wait = Math.min(Math.max(0, session.expiresAt - Date.now()), MAX_TIMEOUT);
    const timer = window.setTimeout(() => {
      if (session.role === 'guest') void ensureGuest().catch(() => undefined);
      else useAuthStore.getState().markExpired();
    }, wait);

    return () => window.clearTimeout(timer);
  }, [session, offline]);

  if (offline || demoMode || session) return <>{children}</>;
  return <AuthView />;
}
