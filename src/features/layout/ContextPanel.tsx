import { Cpu, Gauge, Radio, ShieldCheck, PanelRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useModels } from '@/api/models';
import { useUsage } from '@/api/usage';
import { AI_STATE_LABEL } from '@/features/assistant/ai-state';
import { Orb } from '@/features/assistant/Orb';
import { useMessageCount, useSessions } from '@/features/chat/api';
import { useMemories } from '@/features/memory/api';
import { formatSessionTime } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { useModelStore } from '@/stores/model-store';
import { useSessionMetricsStore } from '@/stores/session-metrics-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useOverlayHistory } from '@/hooks/use-overlay-history';

const SUBSYSTEMS = [
  { icon: Radio, label: 'Streaming', value: 'SSE ativo' },
  { icon: ShieldCheck, label: 'Sanitização', value: 'Markdown seguro' },
] as const;
const EMPTY_METRICS: import('@/stores/session-metrics-store').ResponseMetric[] = [];

export function ContextPanel({ sessionId }: { sessionId: string | null }) {
  const [now, setNow] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const wasMobileOpen = useRef(false);
  const touchStartY = useRef<number | null>(null);
  const closeMobilePanel = useOverlayHistory(mobileOpen, setMobileOpen, 'context');
  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const interval = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (mobileOpen) {
      wasMobileOpen.current = true;
      document.getElementById('nexa-context-close')?.focus();
    } else if (wasMobileOpen.current) {
      wasMobileOpen.current = false;
      mobileTriggerRef.current?.focus();
    }
  }, [mobileOpen]);
  useEffect(() => {
    if (!mobileOpen) return;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobilePanel();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = document.getElementById('nexa-context-panel');
      const focusable = panel?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeMobilePanel, mobileOpen]);
  const aiState = useUiStore((state) => state.aiState);
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const displayName = useSettingsStore((state) => state.settings.displayName);
  const ttsEnabled = useSettingsStore((state) => state.settings.ttsEnabled);
  const auth = useAuthStore((state) => state.session);
  const selectedModel = useModelStore((state) => state.selectedModelId);
  const usage = useUsage();
  const models = useModels();
  const memories = useMemories();
  const metricRows = useSessionMetricsStore((state) => sessionId ? state.bySession[sessionId] ?? EMPTY_METRICS : EMPTY_METRICS);
  const latest = metricRows.at(-1);
  const tokenTotals = metricRows.reduce((sum, item) => ({
    input: sum.input + (item.inputTokens ?? 0), output: sum.output + (item.outputTokens ?? 0),
  }), { input: 0, output: 0 });
  const modelId = latest?.modelId ?? selectedModel ?? models.data?.default_model ?? undefined;
  const model = models.data?.models.find((item) => item.model_id === modelId);
  const activeMemories = memories.data?.filter((memory) => memory.enabled).length ?? 0;
  const averageLatency = metricRows.length ? metricRows.reduce((sum, item) => sum + (item.firstTokenMs ?? 0), 0) / metricRows.filter((item) => item.firstTokenMs !== undefined).length : undefined;
  const averageSpeedRows = metricRows.filter((item) => item.tokensPerSecond !== undefined);
  const averageSpeed = averageSpeedRows.length ? averageSpeedRows.reduce((sum, item) => sum + (item.tokensPerSecond ?? 0), 0) / averageSpeedRows.length : undefined;
  const sessions = useSessions();
  const messages = useMessageCount(sessionId);
  const session = sessions.data?.find((item) => item.id === sessionId);
  const elapsedMinutes = session && now ? Math.max(0, Math.floor((now - new Date(session.createdAt).getTime()) / 60000)) : 0;
  const messageCount = messages.data ?? 0;
  const sessionLabel = sessions.isError
    ? 'Indisponível'
    : (session?.title ?? (sessions.isLoading ? 'Carregando…' : 'Aguardando seleção'));

  return (
    <>
    <button ref={mobileTriggerRef} type="button" aria-expanded={mobileOpen} aria-controls="nexa-context-panel" onClick={() => mobileOpen ? closeMobilePanel() : setMobileOpen(true)} className="absolute bottom-[calc(var(--safe-bottom)+var(--composer-height,5.5rem)+0.75rem)] right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-surface text-primary shadow-lg xl:hidden" aria-label={mobileOpen ? 'Fechar painel do núcleo' : 'Abrir painel do núcleo'}><PanelRight className="h-4 w-4" aria-hidden="true" /></button>
    {mobileOpen && <button type="button" tabIndex={-1} aria-label="Fechar painel do núcleo" onClick={closeMobilePanel} className="fixed inset-0 z-20 bg-black/55 xl:hidden" />}
    <aside
      id="nexa-context-panel"
      aria-label="Painel do núcleo"
      role={mobileOpen ? 'dialog' : undefined}
      aria-modal={mobileOpen ? true : undefined}
      className={`${mobileOpen ? 'fixed inset-x-3 bottom-32 top-20 z-20 flex' : 'hidden'} w-auto shrink-0 flex-col border border-white/10 bg-surface/95 shadow-xl xl:static xl:inset-auto xl:z-auto xl:flex xl:w-72 xl:border-l xl:border-y-0 xl:border-r-0 xl:bg-surface/25 xl:shadow-none`}
    >
      {mobileOpen && <button id="nexa-context-close" type="button" aria-label="Arraste para baixo ou toque para fechar" onClick={closeMobilePanel} onTouchStart={(event) => { touchStartY.current = event.touches[0]?.clientY ?? null; }} onTouchEnd={(event) => { const startY = touchStartY.current; const endY = event.changedTouches[0]?.clientY; if (startY !== null && endY !== undefined && endY - startY > 48) closeMobilePanel(); touchStartY.current = null; }} className="flex h-11 shrink-0 items-center justify-center xl:hidden"><span className="h-1 w-10 rounded-full bg-white/30" /></button>}
      <div className="flex flex-col items-center border-b border-white/5 px-4 py-5">
        <Orb state={aiState} size="md" />
        <p className="mt-3 font-display text-2xs tracking-[0.22em] text-primary">NÚCLEO NEXA</p>
        <p
          role="status"
          aria-live="polite"
          className="mt-1 font-mono text-2xs uppercase tracking-[0.2em] text-muted"
        >
          {AI_STATE_LABEL[aiState]}
        </p>
      </div>

      <div
        role="region"
        aria-label="Detalhes do contexto"
        tabIndex={0}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
      >
        <section>
          <h2 className="font-display text-2xs tracking-[0.22em] text-primary/80">PERFIL</h2>
          <p className="mt-2 truncate text-sm text-foreground">{displayName && displayName !== 'Operador' ? displayName : auth?.username ?? 'Visitante'}</p>
          <p className="font-mono text-2xs uppercase text-muted">{offlineMode ? 'modo offline' : `${auth?.username ?? 'sem conta'} · ${auth?.role ?? 'demo'}`}</p>
        </section>

        <section>
          <h2 className="font-display text-2xs tracking-[0.22em] text-primary/80">IA</h2>
          <p className="mt-2 truncate text-xs text-foreground">{offlineMode ? 'Ollama (local)' : demoMode ? 'NEXA demonstração' : model?.provider ?? 'Provedor —'}</p>
          <p className="truncate font-mono text-2xs text-muted">
            {modelId ?? (offlineMode ? 'Automático' : 'Modelo —')}{!offlineMode && <> · chave {latest?.keySource === 'user' || model?.key_source === 'user' ? 'própria' : 'do servidor'}</>}
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xs tracking-[0.22em] text-primary/80">SESSÃO</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            <div className="col-span-2 rounded-xl border border-white/5 bg-background/40 p-2.5">
              <dt className="font-mono text-2xs uppercase tracking-[0.12em] text-muted/70">
                conversa
              </dt>
              <dd className="mt-0.5 truncate text-[13px] text-foreground">{sessionLabel}</dd>
            </div>
            <div className="rounded-xl border border-white/5 bg-background/40 p-2.5">
              <dt className="font-mono text-2xs uppercase tracking-[0.12em] text-muted/70">
                mensagens
              </dt>
              <dd className="mt-0.5 font-mono text-lg tabular-nums text-primary">
                {messages.isError ? '—' : messageCount.toString().padStart(2, '0')}
              </dd>
            </div>
            <div className="rounded-xl border border-white/5 bg-background/40 p-2.5">
              <dt className="font-mono text-2xs uppercase tracking-[0.12em] text-muted/70">
                atualizada
              </dt>
              <dd className="mt-1 font-mono text-xs text-foreground">
                {session ? formatSessionTime(session.updatedAt) : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="font-display text-2xs tracking-[0.22em] text-primary/80">CONSUMO</h2>
          <p className="mt-2 font-mono text-xs text-foreground">Última: {latest?.inputTokens !== undefined || latest?.outputTokens !== undefined ? `${latest.inputTokens ?? '—'} / ${latest.outputTokens ?? '—'} tokens` : '—'}</p>
          <p className="font-mono text-2xs text-muted">Conversa: {tokenTotals.input || tokenTotals.output ? `${tokenTotals.input} / ${tokenTotals.output} tokens` : '—'}</p>
          {!offlineMode && (
            <div>
              <p className="mt-1 font-mono text-2xs text-muted">
                Hoje: {usage.data?.daily_remaining ?? '—'} · minuto: {usage.data?.per_minute_remaining ?? '—'}
              </p>
              {usage.data?.resets_at && (
                <p className="font-mono text-2xs text-muted">
                  Renova {new Date(usage.data.resets_at).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xs tracking-[0.22em] text-primary/80">TEMPO E CONTEXTO</h2>
          <p className="mt-2 font-mono text-2xs text-muted">Conversa: {elapsedMinutes} min · latência: {averageLatency === undefined || !Number.isFinite(averageLatency) ? '—' : `${(averageLatency / 1000).toFixed(1)} s`} · tokens/s: {averageSpeed === undefined ? '—' : averageSpeed.toFixed(1)}</p>
          <p className="mt-1 font-mono text-2xs text-muted">Memórias ativas: {memories.isLoading ? '…' : activeMemories} · voz: {ttsEnabled ? 'ligada' : 'desligada'}</p>
          <p className="font-mono text-2xs text-muted">Duração última resposta: {latest ? `${(latest.durationMs / 1000).toFixed(1)} s` : '—'}</p>
        </section>

        <section>
          <h2 className="flex items-center gap-1.5 font-display text-2xs tracking-[0.22em] text-primary/80">
            <Gauge className="h-3 w-3" aria-hidden="true" />
            SUBSISTEMAS
          </h2>
          <ul className="mt-2 space-y-1.5">
            {SUBSYSTEMS.map(({ icon: Icon, label, value }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-background/30 px-2.5 py-2"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
                <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted">
                  {label}
                </span>
                <span className="ml-auto text-right text-2xs text-foreground/80">{value}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 rounded-lg border border-white/5 bg-background/30 px-2.5 py-2">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
              <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted">
                Adaptador
              </span>
              <span className="ml-auto text-right text-2xs text-foreground/80">
                {offlineMode ? 'Ollama local' : demoMode ? 'Mock local' : 'HTTP remoto'}
              </span>
            </li>
          </ul>
        </section>

        {demoMode && <div className="rounded-xl border border-warning/20 bg-warning/5 p-2.5">
          <p className="font-mono text-2xs uppercase leading-relaxed tracking-[0.12em] text-warning/90">
            Demonstração · respostas simuladas localmente
          </p>
        </div>}
      </div>
    </aside>
    </>
  );
}
