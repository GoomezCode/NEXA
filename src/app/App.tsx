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
  const effectsMode = useSettingsStore((state) => state.settings.effectsMode);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
    document.documentElement.dataset.theme = theme;
    const root = document.documentElement;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const applyEffects = () => {
      const device = navigator as Navigator & { deviceMemory?: number };
      const constrained = motionPreference.matches || reducedMotion ||
        (device.deviceMemory !== undefined && device.deviceMemory <= 4) ||
        (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) ||
        connection?.saveData === true;
      root.dataset.fx = effectsMode === 'auto' ? (constrained ? 'lite' : 'balanced')
        : reducedMotion || motionPreference.matches ? 'lite' : effectsMode;
    };
    applyEffects();
    motionPreference.addEventListener('change', applyEffects);
    connection?.addEventListener('change', applyEffects);
    return () => {
      delete document.documentElement.dataset.reducedMotion;
      delete document.documentElement.dataset.theme;
      delete document.documentElement.dataset.fx;
      motionPreference.removeEventListener('change', applyEffects);
      connection?.removeEventListener('change', applyEffects);
    };
  }, [effectsMode, reducedMotion, theme]);

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
