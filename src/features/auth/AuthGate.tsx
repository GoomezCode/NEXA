import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ensureGuest } from '@/api/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useConnectionStore } from '@/stores/connection-store';

const AuthView = lazy(() => import('./AuthView').then((module) => ({ default: module.AuthView })));

const MAX_TIMEOUT = 2 ** 31 - 1;

export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const session = useAuthStore((state) => state.session);
  const offline = useConnectionStore((state) => state.mode === 'offline');

  useEffect(() => {
    if (!offline && !demoMode && !session && location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [demoMode, location.pathname, navigate, offline, session]);

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
  return (
    <Suspense fallback={<div role="status" className="flex min-h-dvh items-center justify-center font-mono text-2xs uppercase tracking-[0.2em] text-primary/70">Carregando acesso</div>}>
      <AuthView />
    </Suspense>
  );
}
