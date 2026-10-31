import { Component, Suspense, lazy, useEffect, type ErrorInfo, type ReactNode } from 'react';

import { AppProviders } from './providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthGate } from '@/features/auth/AuthGate';
import { AppShell } from '@/features/layout/AppShell';
import { useInterfaceModeStore } from '@/stores/interface-mode-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';

const ClassicApp = lazy(() => import('@/features/classic/ClassicApp'));

interface ClassicBoundaryProps {
  children: ReactNode;
  onExit: () => void;
}

class ClassicBoundary extends Component<ClassicBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NEXA: falha ao carregar o modo clássico.', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <p className="font-display text-lg tracking-[0.16em] text-foreground">
            Modo clássico indisponível
          </p>
          <p className="max-w-sm text-sm text-muted">
            Não foi possível carregar a réplica. O NEXA HUD continua funcionando normalmente.
          </p>
          <button
            type="button"
            onClick={this.props.onExit}
            className="rounded-xl border border-primary/35 bg-primary/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary transition hover:bg-primary/15"
          >
            Voltar ao NEXA HUD
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function ClassicLoading() {
  return (
    <div
      className="flex h-dvh flex-col items-center justify-center gap-3 bg-background"
      role="status"
      aria-live="polite"
    >
      <span className="h-10 w-10 animate-spin rounded-full border border-primary/25 border-t-primary" />
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary/70">
        carregando interface clássica
      </p>
    </div>
  );
}

export function App() {
  const mode = useInterfaceModeStore((state) => state.mode);
  const setMode = useInterfaceModeStore((state) => state.setMode);
  const reducedMotion = useSettingsStore((state) => state.settings.reducedMotion);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';

    return () => {
      delete document.documentElement.dataset.reducedMotion;
    };
  }, [reducedMotion]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();

        const { aiState } = useUiStore.getState();

        if (aiState === 'processing' || aiState === 'responding') {
          return;
        }

        useInterfaceModeStore.getState().toggleMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <AppProviders>
      {mode === 'classic' ? (
        <ErrorBoundary>
          <AuthGate>
            <ClassicBoundary onExit={() => setMode('nexa')}>
              <Suspense fallback={<ClassicLoading />}>
                <ClassicApp onExit={() => setMode('nexa')} />
              </Suspense>
            </ClassicBoundary>
          </AuthGate>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
          <AuthGate>
            <AppShell />
          </AuthGate>
        </ErrorBoundary>
      )}
    </AppProviders>
  );
}
