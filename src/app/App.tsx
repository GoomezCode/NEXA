import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AppProviders } from './providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthGate } from '@/features/auth/AuthGate';
import { AppShell } from '@/features/layout/AppShell';
import { useSettingsStore } from '@/stores/settings-store';

export function App() {
  const reducedMotion = useSettingsStore((state) => state.settings.reducedMotion);
  const theme = useSettingsStore((state) => state.settings.theme);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.reducedMotion;
      delete document.documentElement.dataset.theme;
    };
  }, [reducedMotion, theme]);

  return (
    <BrowserRouter>
      <AppProviders>
        <ErrorBoundary>
          <AuthGate>
            <AppShell />
          </AuthGate>
        </ErrorBoundary>
      </AppProviders>
    </BrowserRouter>
  );
}
