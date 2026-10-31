import {
  Activity,
  Check,
  Clock,
  Cpu,
  Gauge,
  Layers,
  RefreshCw,
  ShieldCheck,
  Timer,
  Wifi,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { apiOrigin } from '@/api/config';
import { describeError } from '@/api/errors';
import { useApiHealth } from '@/api/health';
import { useModels, type Capability } from '@/api/models';
import { useUsage } from '@/api/usage';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useModelStore } from '@/stores/model-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useConnectionStore } from '@/stores/connection-store';
import { ollamaBase, useOllamaHealth, useOllamaProcesses } from '@/api/ollama';
import { ApiLetter } from './ApiLetter';
import { ProviderKeysPanel } from './ProviderKeysPanel';

type Tone = 'success' | 'warning' | 'danger' | 'muted';

const TONE_STYLES: Record<Tone, string> = {
  success: 'border-success/25 bg-success/5 text-success',
  warning: 'border-warning/25 bg-warning/5 text-warning',
  danger: 'border-danger/25 bg-danger/5 text-danger',
  muted: 'border-white/10 bg-white/5 text-muted',
};

function Badge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.14em]',
        TONE_STYLES[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Activity;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface/50 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-2xs tracking-[0.2em] text-primary">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </h3>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-2xs uppercase tracking-[0.12em] text-muted/70">{label}</dt>
      <dd className="text-right text-[12px] text-foreground">{value}</dd>
    </div>
  );
}

function showCount(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(value);
}

function showDate(value: string | null | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function QuotaMeter({
  label,
  remaining,
  limit,
}: {
  label: string;
  remaining: number | null | undefined;
  limit: number | null | undefined;
}) {
  const hasLimit = typeof limit === 'number' && limit > 0;
  const used = hasLimit && typeof remaining === 'number' ? Math.max(0, limit - remaining) : 0;
  const percent = hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-2xs uppercase tracking-[0.12em] text-muted/70">
          {label}
        </span>
        <span className="font-mono text-lg tabular-nums text-primary">
          {showCount(remaining)}
          <span className="text-xs text-muted">/{showCount(limit)}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: ${showCount(remaining)} de ${showCount(limit)} disponíveis`}
        aria-valuemin={0}
        aria-valuemax={hasLimit ? limit : 100}
        aria-valuenow={hasLimit ? used : 0}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5"
      >
        <div
          className="h-full rounded-full bg-primary/70 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function MonitorView() {
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const health = useApiHealth();
  const usage = useUsage();
  const models = useModels();
  const session = useAuthStore((state) => state.session);
  const selectedModelId = useModelStore((state) => state.selectedModelId);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const apiUrl = useSettingsStore((state) => state.settings.apiUrl);

  if (offlineMode) return <OllamaMonitor />;

  const busy = health.isFetching || usage.isFetching || models.isFetching;
  const endpoint = apiOrigin(apiUrl) || (typeof window === 'undefined' ? '' : window.location.origin);

  const healthTone: Tone = demoMode
    ? 'muted'
    : health.isError || health.data?.status === 'error'
      ? 'danger'
      : health.data?.status === 'degraded'
        ? 'warning'
        : health.data?.status === 'ok'
          ? 'success'
          : 'muted';
  const healthLabel = demoMode
    ? 'modo demo'
    : health.isLoading
      ? 'verificando'
      : health.isError
        ? 'offline'
        : health.data?.status === 'ok'
          ? 'online'
          : health.data?.status === 'degraded'
            ? 'degraded'
            : 'aguardando';

  const healthError = health.isError ? describeError(health.error).message : null;
  const usageError = usage.isError ? describeError(usage.error).message : null;
  const modelsError = models.isError ? describeError(models.error).message : null;
  const modelList = models.data?.models ?? [];
  const providers = models.data?.providers ?? [];
  const capabilities: Capability[] = ['chat', 'stream', 'tools', 'vision', 'json_mode'];

  return (
    <section aria-label="Monitor" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/60 p-5">
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.28em] text-primary/70">
              telemetria do núcleo
            </p>
            <h2 className="font-display text-xl tracking-[0.12em] text-foreground">Monitor</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Saúde da API e cotas reais da sessão atual. Nenhum dado é inventado: o que não vier do
              servidor aparece como indisponível.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void health.refetch();
              void usage.refetch();
              void models.refetch();
            }}
            disabled={demoMode || busy}
            aria-label="Atualizar telemetria"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} aria-hidden="true" />
            {busy ? 'Atualizando…' : 'Atualizar'}
          </button>
        </header>

        {demoMode && (
          <p
            role="status"
            className="rounded-2xl border border-warning/25 bg-warning/5 p-3 text-[12px] leading-relaxed text-warning"
          >
            Modo demonstração ativo: as respostas são geradas localmente e a telemetria da API fica
            desligada. Desative o modo demo nos Ajustes para ver saúde e cotas reais.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Panel title="API" icon={Wifi}>
            <div className="flex items-center justify-between gap-2">
              <Badge tone={healthTone} label={healthLabel} />
              {health.data?.version && (
                <span className="font-mono text-2xs uppercase tracking-[0.12em] text-muted">
                  v{health.data.version}
                </span>
              )}
            </div>
            <dl className="space-y-1.5">
              <Row label="endpoint" value={<span className="font-mono text-2xs">{endpoint}</span>} />
              <Row label="adaptador" value={demoMode ? 'Mock local' : 'HTTP remoto'} />
            </dl>
            {healthError && (
              <p role="alert" className="text-2xs leading-relaxed text-danger">
                {healthError}
              </p>
            )}
            {!demoMode && health.data?.message && (
              <p className="text-2xs leading-relaxed text-muted">{health.data.message}</p>
            )}
          </Panel>

          <Panel title="SESSÃO" icon={ShieldCheck}>
            <div className="flex items-center justify-between gap-2">
              <Badge
                tone={session ? 'success' : 'muted'}
                label={session?.role === 'guest' ? 'convidado' : (session?.role ?? 'sem sessão')}
              />
            </div>
            <dl className="space-y-1.5">
              <Row label="usuário" value={session?.username ?? '—'} />
              <Row
                label="validade"
                value={
                  session
                    ? new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(session.expiresAt))
                    : '—'
                }
              />
            </dl>
          </Panel>

          <Panel title="COTA DIÁRIA" icon={Gauge}>
            {usageError ? (
              <p role="alert" className="text-2xs leading-relaxed text-danger">
                {usageError}
              </p>
            ) : (
              <>
                <QuotaMeter
                  label="mensagens restantes"
                  remaining={usage.data?.daily_remaining}
                  limit={usage.data?.daily_limit}
                />
                <dl className="space-y-1.5">
                  <Row label="renova em" value={showDate(usage.data?.resets_at)} />
                </dl>
              </>
            )}
          </Panel>

          <Panel title="POR MINUTO" icon={Timer}>
            {usageError ? (
              <p role="alert" className="text-2xs leading-relaxed text-danger">
                {usageError}
              </p>
            ) : (
              <QuotaMeter
                label="mensagens restantes"
                remaining={usage.data?.per_minute_remaining}
                limit={usage.data?.per_minute_limit}
              />
            )}
          </Panel>

          <div className="sm:col-span-2">
            <Panel title="MODELOS E PROVEDORES" icon={Layers}>
              {demoMode ? (
                <p className="text-2xs leading-relaxed text-muted">
                  Catálogo indisponível no modo demonstração.
                </p>
              ) : modelsError ? (
                <p role="alert" className="text-2xs leading-relaxed text-danger">
                  {modelsError}
                </p>
              ) : models.isLoading ? (
                <p role="status" className="font-mono text-2xs uppercase tracking-[0.12em] text-muted">
                  Carregando catálogo…
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      tone={modelList.length ? 'success' : 'muted'}
                      label={`${modelList.length} ${modelList.length === 1 ? 'modelo' : 'modelos'}`}
                    />
                    {providers.length > 0 && (
                      <ul
                        aria-label="Provedores"
                        className="flex flex-wrap items-center gap-1.5"
                      >
                        {providers.map((provider) => (
                          <li
                            key={provider.provider}
                            title={
                              provider.available
                                ? `${provider.name} disponível`
                                : `${provider.name} indisponível`
                            }
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.1em]',
                              provider.available
                                ? 'border-success/20 bg-success/5 text-success'
                                : 'border-white/10 bg-white/5 text-muted',
                            )}
                          >
                            <Cpu className="h-2.5 w-2.5" aria-hidden="true" />
                            {provider.name}
                            {!provider.available && <span>· indisponível</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <dl className="space-y-1.5">
                    <Row
                      label="modelo padrão"
                      value={<span className="font-mono text-2xs">{models.data?.default_model ?? 'Automático'}</span>}
                    />
                    <Row
                      label="em uso"
                      value={<span className="font-mono text-2xs">{selectedModelId ?? 'Automático'}</span>}
                    />
                  </dl>

                  <ul
                    aria-label="Selecionar modelo"
                    className="max-h-72 space-y-1.5 overflow-y-auto pr-1"
                  >
                    <li>
                      <button
                        type="button"
                        onClick={() => setSelectedModel(null)}
                        aria-pressed={selectedModelId === null}
                        aria-label="Usar seleção automática"
                        className={cn(
                          'flex min-h-11 w-full items-center gap-2 rounded-xl border p-2.5 text-left transition',
                          selectedModelId === null
                            ? 'border-primary/35 bg-primary/10'
                            : 'border-white/5 bg-background/40 hover:border-primary/25',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-foreground">
                          {selectedModelId === null && (
                            <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                          )}
                          Automático
                        </span>
                        <span className="ml-auto font-mono text-2xs text-muted/70">
                          o servidor escolhe
                        </span>
                      </button>
                    </li>

                    {modelList.map((model) => {
                      const selected = selectedModelId === model.model_id;

                      return (
                        <li key={model.model_id}>
                          <button
                            type="button"
                            onClick={() => setSelectedModel(model.model_id)}
                            disabled={model.selectable === false}
                            aria-pressed={selected}
                            aria-label={`Usar modelo ${model.name}`}
                            className={cn(
                              'w-full rounded-xl border p-2.5 text-left transition',
                              selected
                                ? 'border-primary/35 bg-primary/10'
                                : 'border-white/5 bg-background/40 hover:border-primary/25',
                              model.selectable === false &&
                                'cursor-not-allowed opacity-60 hover:border-white/5',
                            )}
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                              <span className="flex items-center gap-1.5 text-[12px] text-foreground">
                                {selected && (
                                  <Check
                                    className="h-3 w-3 shrink-0 text-primary"
                                    aria-hidden="true"
                                  />
                                )}
                                {model.name}
                                {model.selectable === false && (
                                  <span className="text-2xs text-muted">· indisponível</span>
                                )}
                              </span>
                              <span className="font-mono text-2xs text-muted/70">
                                {model.model_id}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.1em]">
                              {model.provider && (
                                <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-primary/80">
                                  {model.provider}
                                </span>
                              )}
                              {model.key_source === 'user' && (
                                <span className="rounded-full border border-success/20 bg-success/5 px-2 py-0.5 text-success/80">
                                  chave própria
                                </span>
                              )}
                              {typeof model.context_window === 'number' && (
                                <span className="text-muted/70">
                                  {model.context_window.toLocaleString('pt-BR')} tokens
                                </span>
                              )}
                              {capabilities
                                .filter((capability) =>
                                  model.capabilities?.includes(capability),
                                )
                                .map((capability) => (
                                  <span
                                    key={capability}
                                    className="rounded-full border border-white/10 px-2 py-0.5 text-muted"
                                  >
                                    {capability}
                                  </span>
                                ))}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {modelList.length === 0 && (
                    <p className="text-2xs text-muted">
                      Nenhum modelo disponível; a seleção automática continua ativa.
                    </p>
                  )}
                </>
              )}
            </Panel>
          </div>
        </div>

        <ProviderKeysPanel />

        <ApiLetter />

        <p className="flex items-center gap-1.5 pb-2 font-mono text-2xs uppercase tracking-[0.1em] text-muted/60">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {demoMode
            ? 'telemetria desligada no modo demonstração'
            : health.dataUpdatedAt
              ? `saúde verificada às ${new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' }).format(health.dataUpdatedAt)}`
              : 'aguardando a primeira verificação'}
        </p>
      </div>
    </section>
  );
}

function OllamaMonitor() {
  const health = useOllamaHealth();
  const processes = useOllamaProcesses();
  const models = useModels();
  const refresh = () => { void health.refetch(); void processes.refetch(); void models.refetch(); };
  const busy = health.isFetching || processes.isFetching || models.isFetching;
  const tone: Tone = health.isError ? 'danger' : health.isLoading ? 'muted' : 'success';
  return (
    <section aria-label="Monitor Ollama" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/60 p-5">
          <div><p className="font-mono text-2xs uppercase tracking-[0.28em] text-primary/70">execução local</p><h2 className="font-display text-xl tracking-[0.12em] text-foreground">Monitor Ollama</h2><p className="mt-1 text-sm text-muted">Status e modelos disponíveis nesta máquina.</p></div>
          <button type="button" onClick={refresh} disabled={busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 font-mono text-2xs uppercase text-primary disabled:opacity-40"><RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />{busy ? 'Atualizando…' : 'Atualizar'}</button>
        </header>
        <Panel title="OLLAMA LOCAL" icon={Wifi}><div className="flex justify-between"><Badge tone={tone} label={health.isError ? 'offline' : health.isLoading ? 'verificando' : 'online'} /><span className="font-mono text-2xs text-muted">{health.data ? `v${health.data}` : ''}</span></div><dl><Row label="URL local" value={<span className="font-mono text-2xs">{ollamaBase()}</span>} /><Row label="Modelos instalados" value={models.data?.models.length ?? '…'} /><Row label="Modelos carregados" value={processes.data?.models.length ?? (processes.isError ? 'indisponível' : '…')} /></dl>{health.isError && <p role="alert" className="text-2xs text-danger">{health.error instanceof Error ? health.error.message : 'Ollama indisponível. Inicie com ollama serve.'}</p>}</Panel>
        <Panel title="MODELOS LOCAIS" icon={Layers}>{models.isLoading && <p className="text-xs text-muted">Consultando Ollama…</p>}{models.isError && <p role="alert" className="text-xs text-danger">{describeError(models.error).message}</p>}{models.data?.models.length === 0 && <p className="text-xs text-muted">Nenhum modelo instalado. Execute <code>ollama pull &lt;modelo&gt;</code>.</p>}<ul className="space-y-2">{models.data?.models.map((model) => <li key={model.model_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-background/40 p-3"><span className="min-w-0"><span className="block truncate text-sm text-foreground">{model.name}</span><span className="font-mono text-2xs text-muted">{model.family ?? 'família desconhecida'} · {model.parameter_size ?? 'parâmetros —'} · {model.quantization_level ?? 'quantização —'} · {model.context_window ?? '—'} tokens{model.size_bytes ? ` · ${(model.size_bytes / 1_000_000_000).toFixed(1)} GB` : ''}</span></span><Badge tone="success" label="local" /></li>)}</ul></Panel>
      </div>
    </section>
  );
}
