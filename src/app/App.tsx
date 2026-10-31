import { useEffect } from 'react';

import { AppProviders } from './providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthGate } from '@/features/auth/AuthGate';
import { AppShell } from '@/features/layout/AppShell';
import { useSettingsStore } from '@/stores/settings-store';

export function App() {
  const reducedMotion = useSettingsStore((state) => state.settings.reducedMotion);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
    return () => {
      delete document.documentElement.dataset.reducedMotion;
    };
  }, [reducedMotion]);

  return (
    <AppProviders>
      <ErrorBoundary>
        <AuthGate>
          <AppShell />
        </AuthGate>
      </ErrorBoundary>
    </AppProviders>
  );
}
