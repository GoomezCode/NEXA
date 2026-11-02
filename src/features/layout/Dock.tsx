import { Activity, Brain, LogOut, MessageSquare, PanelLeft, PanelRight, Settings } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { formatClock, formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { logout } from '@/api/auth';
import { useConnectionStore } from '@/stores/connection-store';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';

type AppView = 'chat' | 'memory' | 'monitor' | 'settings';

const NAV_ITEMS: { id: AppView; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'memory', label: 'Memória', icon: Brain },
  { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

const TOGGLE_CLASS = {
  open: 'border-primary/35 bg-primary/10 text-primary',
  closed: 'border-transparent text-muted hover:border-border hover:bg-surface-2 hover:text-foreground',
} as const;

/** Relógio isolado: apenas este componente re-renderiza a cada segundo. */
export const DockClock = memo(function DockClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="hidden shrink-0 flex-col items-end leading-tight min-[390px]:flex">
      <time
        dateTime={now.toISOString()}
        className="whitespace-nowrap font-mono text-2xs tabular-nums text-muted"
      >
        {formatClock(now)}
      </time>
      <span className="hidden whitespace-nowrap text-2xs uppercase tracking-[0.08em] text-muted sm:block">
        {formatShortDate(now)}
      </span>
    </div>
  );
});

function NavButton({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      title={item.label}
      className={cn(
        'relative flex h-11 min-w-11 flex-1 items-center justify-center gap-2 rounded-lg border px-1 whitespace-nowrap sm:flex-none sm:px-3',
        active ? TOGGLE_CLASS.open : TOGGLE_CLASS.closed,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden text-2xs font-medium uppercase tracking-[0.1em] sm:inline">
        {item.label}
      </span>
    </Button>
  );
}

export function Dock() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktopSidebar = useMediaQuery('(min-width: 1024px)');
  const isDesktopCore = useMediaQuery('(min-width: 1280px)');
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const contextPanelOpen = useUiStore((state) => state.contextPanelOpen);
  const toggleContextPanel = useUiStore((state) => state.toggleContextPanel);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const session = useAuthStore((state) => state.session);
  const demoMode = useSettingsStore((state) => state.settings.demoMode);

  const activeView: AppView = location.pathname === '/settings' ? 'settings'
    : location.pathname === '/memory' ? 'memory'
      : location.pathname === '/monitor' ? 'monitor' : 'chat';
  const isChat = activeView === 'chat';
  const setActiveView = (view: AppView) => navigate(view === 'chat' ? '/' : `/${view}`);
  const sessionsSheetOpen = searchParams.get('panel') === 'sessions';
  const coreDrawerOpen = searchParams.get('panel') === 'core';
  const conversationsOpen = isDesktopSidebar ? sidebarOpen : sessionsSheetOpen;
  const coreOpen = isDesktopCore ? contextPanelOpen : coreDrawerOpen;

  const togglePanel = (panel: 'sessions' | 'core') => {
    const willOpen = searchParams.get('panel') !== panel;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (willOpen) next.set('panel', panel);
      else if (next.get('panel') === panel) next.delete('panel');
      return next;
    }, { replace: !willOpen });
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="nexa-dock relative z-20 flex min-h-16 shrink-0 items-center gap-1 border-t border-border bg-background/80 pt-1.5 backdrop-blur-xl sm:gap-2"
    >
      <div className="flex min-w-0 flex-1 items-center justify-start gap-1.5 sm:gap-3">
        <Button
          id="open-sessions-button"
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            if (isDesktopSidebar) toggleSidebar();
            else togglePanel('sessions');
          }}
          aria-pressed={conversationsOpen}
          aria-label={conversationsOpen ? 'Ocultar conversas' : 'Mostrar conversas'}
          title={conversationsOpen ? 'Ocultar conversas' : 'Mostrar conversas'}
          className={cn('h-11 w-11 shrink-0 rounded-lg border', conversationsOpen ? TOGGLE_CLASS.open : TOGGLE_CLASS.closed)}
        >
          <PanelLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        {offlineMode && (
          <span
            role="status"
            aria-label="Modo offline"
            title="Modo offline · Ollama local"
            className="flex min-w-0 items-center gap-1.5 text-2xs text-muted"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            <span className="hidden truncate md:inline">Offline · Ollama local</span>
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeView === item.id}
            onClick={() => setActiveView(item.id)}
          />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-3">
        {(offlineMode || (!demoMode && session)) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              if (offlineMode) useConnectionStore.getState().setMode('api');
              logout();
            }}
            aria-label={offlineMode ? 'Sair do modo offline' : session?.role === 'guest' ? 'Sair do modo convidado' : 'Sair da conta'}
            title={offlineMode ? 'Sair do modo offline' : session?.role === 'guest' ? 'Sair do modo convidado' : 'Sair da conta'}
            className="h-11 w-11 shrink-0 rounded-lg border border-transparent text-muted hover:border-danger/30 hover:bg-danger/5 hover:text-danger"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
        {isChat && (
          <Button
            id="dock-core-toggle"
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isDesktopCore) toggleContextPanel();
              else togglePanel('core');
            }}
            aria-pressed={coreOpen}
            aria-label={coreOpen ? 'Fechar painel do núcleo' : 'Abrir painel do núcleo'}
            title={coreOpen ? 'Fechar painel do núcleo' : 'Abrir painel do núcleo'}
            className={cn('h-11 w-11 shrink-0 rounded-lg border', coreOpen ? TOGGLE_CLASS.open : TOGGLE_CLASS.closed)}
          >
            <PanelRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
        <DockClock />
      </div>
    </nav>
  );
}
