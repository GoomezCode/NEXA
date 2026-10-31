import { Sparkles } from 'lucide-react';
import { Suspense, lazy, useEffect } from 'react';

import { useSessions } from '@/features/chat/api';
import { ChatView } from '@/features/chat/ChatView';
import { SessionsSidebar } from '@/features/chat/SessionsSidebar';
import { ConnectionNotifier } from '@/features/notifications/ConnectionNotifier';
import { NotificationCenter } from '@/features/notifications/NotificationCenter';
import { useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';
import { useVisualViewport } from '@/hooks/use-visual-viewport';

import { BackgroundCanvas } from './BackgroundCanvas';
import { ContextPanel } from './ContextPanel';
import { Dock } from './Dock';
import { SessionsSheet } from './SessionsSheet';
import { TopBar } from './TopBar';
import { useGlobalShortcuts } from './use-global-shortcuts';

const SettingsView = lazy(() =>
  import('@/features/settings/SettingsView').then((module) => ({
    default: module.SettingsView,
  })),
);

const MemoryView = lazy(() =>
  import('@/features/memory/MemoryView').then((module) => ({
    default: module.MemoryView,
  })),
);

const MonitorView = lazy(() =>
  import('@/features/monitor/MonitorView').then((module) => ({
    default: module.MonitorView,
  })),
);

function ViewLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3"
    >
      <span className="h-8 w-8 animate-spin rounded-full border border-primary/25 border-t-primary" />
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/70">
        carregando {label}
      </p>
    </div>
  );
}

export function AppShell() {
  useVisualViewport();
  const activeView = useUiStore((state) => state.activeView);
  const activeSessionId = useUiStore((state) => state.activeSessionId);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setActiveSessionId = useUiStore((state) => state.setActiveSessionId);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const sessions = useSessions();

  useGlobalShortcuts();

  useEffect(() => {
    if (!activeSessionId && sessions.data && sessions.data.length > 0) {
      setActiveSessionId(sessions.data[0].id);
    }
  }, [activeSessionId, sessions.data, setActiveSessionId]);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <nav aria-label="Ir para o conteúdo">
        <a
          href="#nexa-main"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById('nexa-main')?.focus();
          }}
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:border focus:border-primary/40 focus:bg-surface focus:px-3 focus:py-2 focus:font-mono focus:text-[10px] focus:uppercase focus:tracking-[0.12em] focus:text-primary"
        >
          Ir para o conteúdo
        </a>
      </nav>

      <div className="nexa-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <BackgroundCanvas />

      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl"
        aria-hidden="true"
      />

      <div className="nexa-shell-content relative z-10 flex min-h-0 flex-1 flex-col">
        <TopBar />

        {demoMode && (
          <div
            role="status"
            aria-label="Aviso de demonstração"
            className="flex shrink-0 items-center gap-2 border-b border-warning/15 bg-warning/5 px-3 py-1.5 sm:px-5 short:py-0"
          >
            <Sparkles className="h-3 w-3 shrink-0 text-warning" aria-hidden="true" />
            <p className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-warning/90">
              Modo demonstração · respostas simuladas localmente
            </p>
            <button
              type="button"
              onClick={() => setActiveView('settings')}
              className="ml-auto min-h-11 shrink-0 rounded-lg border border-warning/25 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-warning transition hover:bg-warning/10"
            >
              Ajustes
            </button>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1">
          {sidebarOpen && (
            <aside className="hidden w-56 shrink-0 border-r border-white/5 bg-surface/25 md:flex md:flex-col lg:w-64">
              <SessionsSidebar className="min-h-0 flex-1" />
            </aside>
          )}

          <main id="nexa-main" tabIndex={-1} className="relative flex min-w-0 flex-1 flex-col">
            {activeView === 'chat' ? (
              <ChatView sessionId={activeSessionId} />
            ) : activeView === 'settings' ? (
              <Suspense fallback={<ViewLoading label="ajustes" />}>
                <SettingsView />
              </Suspense>
            ) : activeView === 'memory' ? (
              <Suspense fallback={<ViewLoading label="memória" />}>
                <MemoryView />
              </Suspense>
            ) : (
              <Suspense fallback={<ViewLoading label="monitor" />}>
                <MonitorView />
              </Suspense>
            )}
          </main>

          {activeView === 'chat' && <ContextPanel sessionId={activeSessionId} />}
        </div>

        <Dock />
      </div>

      <SessionsSheet />
      <NotificationCenter />
      <ConnectionNotifier />
    </div>
  );
}
