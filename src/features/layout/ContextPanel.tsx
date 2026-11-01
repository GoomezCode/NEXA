import { Cpu, Gauge, Radio, ShieldCheck, PanelRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { useSearchParams } from 'react-router-dom';

import { useModels } from '@/api/models';
import { useUsage } from '@/api/usage';
import { AI_STATE_LABEL } from '@/features/assistant/ai-state';
import { Orb } from '@/features/assistant/Orb';
import { useMessageCount, useSessions } from '@/features/chat/api';
import { useMemories } from '@/features/memory/api';
import { formatSessionTime } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { useModelStore } from '@/stores/model-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useSpeechStore } from '@/stores/speech-store';
import { IconButton } from '@/components/ui/Button';
import { useCoreMetrics } from './use-core-metrics';

const SUBSYSTEMS = [
  { icon: Radio, label: 'Streaming', value: 'SSE ativo' },
  { icon: ShieldCheck, label: 'Sanitização', value: 'Markdown seguro' },
] as const;

export function ContextPanel({ sessionId }: { sessionId: string | null }) {
  const [now, setNow] = useState(0);
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(0.5);
  const [searchParams, setSearchParams] = useSearchParams();
  const mobileOpen = searchParams.get('panel') === 'core';
  const setMobileOpen = (open: boolean) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (open) next.set('panel', 'core');
      else if (next.get('panel') === 'core') next.delete('panel');
      return next;
    }, { replace: !open });
  };
  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const interval = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const aiState = useUiStore((state) => state.aiState);
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const displayName = useSettingsStore((state) => state.settings.displayName);
  const ttsEnabled = useSettingsStore((state) => state.settings.ttsEnabled);
  const isSpeaking = useSpeechStore((state) => state.isSpeaking);
  const auth = useAuthStore((state) => state.session);
  const selectedModel = useModelStore((state) => state.selectedModelId);
  const usage = useUsage();
  const models = useModels();
  const memories = useMemories();
  const { latest, tokenTotals, averageLatency, averageSpeed } = useCoreMetrics(sessionId);
  const modelId = latest?.modelId ?? selectedModel ?? models.data?.default_model ?? undefined;
  const model = models.data?.models.find((item) => item.model_id === modelId);
  const activeMemories = memories.data?.filter((memory) => memory.enabled).length ?? 0;
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
    <Drawer.Root open={mobileOpen} onOpenChange={setMobileOpen} modal snapPoints={[0.5, 0.9]} activeSnapPoint={activeSnapPoint} setActiveSnapPoint={setActiveSnapPoint}>
      <Drawer.Trigger asChild>
        <IconButton label={mobileOpen ? 'Fechar painel do núcleo' : 'Abrir painel do núcleo'} aria-expanded={mobileOpen} aria-controls="nexa-core-drawer" className="absolute bottom-[calc(var(--safe-bottom)+var(--composer-height,5.5rem)+0.75rem)] right-3 z-30 rounded-full border-primary/30 bg-surface text-primary shadow-lg xl:hidden"><PanelRight className="h-4 w-4" aria-hidden="true" /></IconButton>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm xl:hidden" />
        <Drawer.Content id="nexa-core-drawer" className="fixed inset-x-0 bottom-0 z-50 flex h-[90dvh] flex-col rounded-t-2xl border border-border bg-surface outline-none xl:hidden">
          <Drawer.Handle className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted/50" />
          <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div><Drawer.Title className="font-display text-xs tracking-[0.2em] text-primary">NÚCLEO NEXA</Drawer.Title><Drawer.Description className="mt-1 text-xs text-muted">Estado e contexto da conversa atual.</Drawer.Description></div>
            <Drawer.Close asChild><IconButton label="Fechar painel do núcleo" className="text-muted"><PanelRight className="h-4 w-4" /></IconButton></Drawer.Close>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,var(--safe-bottom))]">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3"><Orb state={aiState} size="sm" /><div><p role="status" aria-live="polite" className="font-mono text-xs uppercase tracking-wider text-primary">{isSpeaking ? 'Lendo resposta' : AI_STATE_LABEL[aiState]}</p><p className="mt-1 text-sm text-foreground">{offlineMode ? 'Ollama local' : demoMode ? 'NEXA demonstração' : model?.provider ?? 'Provedor —'} · {modelId ?? (offlineMode ? 'Automático' : 'Modelo —')}</p></div></div>
            <section className="rounded-xl border border-border/60 p-3"><h3 className="font-mono text-xs uppercase tracking-wider text-muted">Conversa</h3><p className="mt-1 truncate text-sm text-foreground">{sessionLabel}</p><p className="mt-2 text-xs text-muted">{messageCount} mensagens · {elapsedMinutes} min · {activeMemories} memórias ativas</p></section>
            <section className="rounded-xl border border-border/60 p-3"><h3 className="font-mono text-xs uppercase tracking-wider text-muted">Uso desta sessão</h3><p className="mt-1 text-sm text-foreground">{tokenTotals.input} tokens de entrada · {tokenTotals.output} de saída</p><p className="mt-1 text-xs text-muted">Latência {averageLatency === undefined || !Number.isFinite(averageLatency) ? '—' : `${(averageLatency / 1000).toFixed(1)} s`} · {averageSpeed === undefined ? '—' : `${averageSpeed.toFixed(1)} tokens/s`}</p></section>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
    <aside
      id="nexa-context-panel"
      aria-label="Painel do núcleo"
      className="hidden w-72 shrink-0 flex-col border-l border-border/50 bg-surface/25 xl:flex"
    >
      <div className="flex flex-col items-center border-b border-white/5 px-4 py-5">
        <Orb state={aiState} size="md" />
        <p className="mt-3 font-display text-2xs tracking-[0.22em] text-primary">NÚCLEO NEXA</p>
        <p
          role="status"
          aria-live="polite"
          className="mt-1 font-mono text-2xs uppercase tracking-[0.2em] text-muted"
        >
          {isSpeaking ? 'Lendo resposta' : AI_STATE_LABEL[aiState]}
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
          <p className="mt-2 truncate text-sm text-foreground">{displayName || auth?.username || 'Visitante'}</p>
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
