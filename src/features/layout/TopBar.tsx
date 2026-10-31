import { Menu, PanelLeft, Settings } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { logout } from '@/api/auth';
import { NexaMark } from '@/components/brand/NexaMark';
import { Badge } from '@/components/ui/Badge';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatClock, formatShortDate } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useNavigate, useSearchParams } from 'react-router-dom';

function StatusChip({ tone, label }: { tone: 'success' | 'warning'; label: string }) {
  return (
    <Badge tone={tone}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${tone === 'success' ? 'bg-success' : 'bg-warning'}`}
        aria-hidden="true"
      />
      {label}
    </Badge>
  );
}

const Clock = memo(function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="text-right leading-tight">
      <p className="font-mono text-sm tabular-nums text-primary">{formatClock(now)}</p>
      <p className="hidden font-mono text-2xs uppercase tracking-[0.12em] text-muted sm:block">
        {formatShortDate(now)}
      </p>
    </div>
  );
});

export function TopBar() {
  const online = useOnlineStatus();
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const session = useAuthStore((state) => state.session);
  const aiState = useUiStore((state) => state.aiState);
  const busy = aiState === 'processing' || aiState === 'responding';
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <header className="relative z-20 flex h-14 min-h-[calc(3.5rem+var(--safe-top))] shrink-0 items-center gap-2 border-b border-white/5 bg-background/70 px-3 ps-[max(0.75rem,var(--safe-left))] pe-[max(0.75rem,var(--safe-right))] pt-[var(--safe-top)] backdrop-blur-xl sm:gap-3 sm:px-5">
      <button
        id="open-sessions-button"
        type="button"
        onClick={() => setSearchParams((current) => { const next = new URLSearchParams(current); next.set('panel', 'sessions'); return next; })}
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
        <Clock />

        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted transition hover:border-primary/30 hover:text-primary"
          aria-label="Abrir ajustes"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
