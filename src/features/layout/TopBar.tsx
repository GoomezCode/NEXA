import { Menu, MessageSquare, MonitorPlay, PanelLeft, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';

import { logout } from '@/api/auth';
import { NexaMark } from '@/components/brand/NexaMark';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatClock, formatShortDate } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { useInterfaceModeStore } from '@/stores/interface-mode-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';
import { useConnectionStore } from '@/stores/connection-store';

function StatusChip({ tone, label }: { tone: 'success' | 'warning'; label: string }) {
  const styles =
    tone === 'success'
      ? 'border-success/25 bg-success/5 text-success'
      : 'border-warning/25 bg-warning/5 text-warning';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.14em] ${styles}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${tone === 'success' ? 'bg-success' : 'bg-warning'}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function TopBar() {
  const [now, setNow] = useState(() => new Date());
  const online = useOnlineStatus();
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const session = useAuthStore((state) => state.session);
  const mode = useInterfaceModeStore((state) => state.mode);
  const setMode = useInterfaceModeStore((state) => state.setMode);
  const aiState = useUiStore((state) => state.aiState);
  const busy = aiState === 'processing' || aiState === 'responding';
  const setActiveView = useUiStore((state) => state.setActiveView);
  const setSessionsSheetOpen = useUiStore((state) => state.setSessionsSheetOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-white/5 bg-background/70 px-3 backdrop-blur-xl sm:gap-3 sm:px-5">
      <button
        type="button"
        onClick={() => setSessionsSheetOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted transition hover:border-primary/30 hover:text-primary md:hidden"
        aria-label="Abrir conversas"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={toggleSidebar}
        className="hidden h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted transition hover:border-primary/30 hover:text-primary md:flex"
        aria-label="Alternar barra lateral"
      >
        <PanelLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-2.5">
        <NexaMark size={28} />
        <div>
          <h1 className="font-display text-[13px] tracking-[0.3em] text-foreground">NEXA</h1>
          <p className="hidden font-mono text-2xs uppercase tracking-[0.2em] text-muted sm:block">
            interface neural
          </p>
        </div>
      </div>

      <div className="ml-2 hidden items-center gap-2 md:flex">
        {offlineMode ? (
          <>
            <StatusChip tone="warning" label="modo offline · ollama local" />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                useConnectionStore.getState().setMode('api');
                useAuthStore.getState().clear();
              }}
              className="min-h-11 rounded-xl border border-white/10 px-3 font-mono text-2xs uppercase tracking-[0.12em] text-muted transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
            >Sair do offline</button>
          </>
        ) : <>
        <StatusChip
          tone={online ? 'success' : 'warning'}
          label={online ? 'núcleo online' : 'sem conexão'}
        />
        <StatusChip
          tone={demoMode ? 'warning' : 'success'}
          label={demoMode ? 'modo demo' : 'api conectada'}
        />
        {!demoMode && session && (
          <>
            <StatusChip
              tone="success"
              label={session.role === 'guest' ? 'convidado' : (session.username ?? session.role)}
            />
            <button
              type="button"
              onClick={logout}
              className="min-h-11 rounded-xl border border-white/10 px-3 font-mono text-2xs uppercase tracking-[0.12em] text-muted transition hover:border-primary/30 hover:text-primary"
            >
              {session.role === 'guest' ? 'Entrar' : 'Sair'}
            </button>
          </>
        )}
        </>}
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div
          role="group"
          aria-label="Modo de interface"
          title={busy ? 'Aguarde a resposta terminar' : undefined}
          className="hidden items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 p-0.5 sm:flex"
        >
          <button
            type="button"
            onClick={() => setMode('nexa')}
            disabled={busy}
            aria-label="NEXA HUD"
            aria-pressed={mode === 'nexa'}
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
              mode === 'nexa' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setMode('classic')}
            disabled={busy}
            aria-label="Modo clássico"
            aria-pressed={mode === 'classic'}
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
              mode === 'classic' ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMode(mode === 'classic' ? 'nexa' : 'classic')}
          disabled={busy}
          aria-label={mode === 'classic' ? 'Voltar ao NEXA HUD' : 'Abrir modo clássico'}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted transition hover:border-primary/30 hover:text-primary disabled:opacity-40 sm:hidden"
        >
          {mode === 'classic' ? <MessageSquare className="h-4 w-4" aria-hidden="true" /> : <MonitorPlay className="h-4 w-4" aria-hidden="true" />}
        </button>

        <div className="text-right leading-tight">
          <p className="font-mono text-sm tabular-nums text-primary">{formatClock(now)}</p>
          <p className="hidden font-mono text-2xs uppercase tracking-[0.12em] text-muted sm:block">
            {formatShortDate(now)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveView('settings')}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted transition hover:border-primary/30 hover:text-primary"
          aria-label="Abrir ajustes"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
