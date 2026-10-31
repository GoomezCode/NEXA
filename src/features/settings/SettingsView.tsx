import {
  AudioLines,
  Gauge,
  LogOut,
  Mic,
  Palette,
  Plug,
  RotateCcw,
  ShieldCheck,
  User,
  Volume2,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { logout } from '@/api/auth';
import { isSpeechRecognitionSupported } from '@/features/voice/use-speech-recognition';
import { cancelSpeech, isSpeechSynthesisSupported, speakText } from '@/lib/speech';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settings-store';
import { useConnectionStore } from '@/stores/connection-store';
import { ollamaVersion } from '@/api/ollama';
import { resetChatAdapter } from '@/api';

function SettingSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/5 bg-background/40 p-3 text-left transition hover:border-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-[13px] text-foreground">{label}</span>
        {description && (
          <span className="mt-0.5 block text-2xs leading-relaxed text-muted">{description}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition',
          checked ? 'border-primary/40 bg-primary/20' : 'border-white/10 bg-white/5',
        )}
      >
        <span
          className={cn(
            'h-3.5 w-3.5 rounded-full transition',
            checked ? 'translate-x-4 bg-primary' : 'translate-x-0 bg-muted/60',
          )}
        />
      </span>
    </button>
  );
}

function SectionCard({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: typeof User;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-border bg-surface/50 p-4 sm:p-5"
    >
      <h3
        id={id}
        className="flex items-center gap-2 font-display text-2xs tracking-[0.2em] text-primary"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </h3>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

function AccountSettings() {
  const session = useAuthStore((state) => state.session);
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');

  if (offlineMode) return <p className="text-2xs leading-relaxed text-muted">Modo offline — sem conta. Suas conversas ficam neste navegador.</p>;

  if (demoMode || !session) {
    return (
      <p className="text-2xs leading-relaxed text-muted">
        Sessão não autenticada. Entre ou continue como convidado na tela de acesso.
      </p>
    );
  }

  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
        <dt className="text-muted">Papel</dt>
        <dd className="text-foreground">{session.role}</dd>
        <dt className="text-muted">Usuário</dt>
        <dd className="text-foreground">{session.username ?? 'convidado'}</dd>
        <dt className="text-muted">Validade</dt>
        <dd className="font-mono text-2xs text-foreground">
          {new Date(session.expiresAt).toLocaleString()}
        </dd>
      </dl>
      <button
        type="button"
        onClick={logout}
        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted transition hover:border-primary/30 hover:text-primary"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        {session.role === 'guest' ? 'Entrar com conta' : 'Sair'}
      </button>
    </>
  );
}

export function SettingsView() {
  const connectionMode = useConnectionStore((state) => state.mode);
  const ollamaUrl = useConnectionStore((state) => state.ollamaUrl);
  const numCtx = useConnectionStore((state) => state.numCtx);
  const setConnectionMode = useConnectionStore((state) => state.setMode);
  const setOllamaConfig = useConnectionStore((state) => state.setOllamaConfig);
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const reset = useSettingsStore((state) => state.reset);

  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [demoMode, setDemoMode] = useState(settings.demoMode);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);

  const voiceInputSupported = isSpeechRecognitionSupported();
  const speechSupported = isSpeechSynthesisSupported();
  useEffect(() => {
    if (!speechSupported) return;
    const synth = window.speechSynthesis;
    const updateVoices = () => setVoices(synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('pt-br')));
    updateVoices();
    synth.addEventListener('voiceschanged', updateVoices);
    return () => synth.removeEventListener('voiceschanged', updateVoices);
  }, [speechSupported]);
  const normalizedApiUrl = apiUrl.trim();
  const validApiUrl =
    normalizedApiUrl.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(normalizedApiUrl);
  const connectionDirty = normalizedApiUrl !== settings.apiUrl || demoMode !== settings.demoMode;

  const applyConnection = () => {
    if (!validApiUrl) {
      setConnectionError('Informe uma URL relativa (/api/v1) ou completa (https://…).');
      return;
    }

    setConnectionError(null);
    update({ apiUrl: normalizedApiUrl, demoMode });
    resetChatAdapter();
  };

  const resetAll = () => {
    reset();
    setApiUrl(DEFAULT_SETTINGS.apiUrl);
    setDemoMode(DEFAULT_SETTINGS.demoMode);
    setConnectionError(null);
  };

  return (
    <section aria-label="Ajustes" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto w-full max-w-2xl space-y-3">
        <header className="rounded-2xl border border-border bg-surface/60 p-5">
          <p className="font-mono text-2xs uppercase tracking-[0.28em] text-primary/70">
            configuração
          </p>
          <h2 className="font-display text-xl tracking-[0.12em] text-foreground">Ajustes</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Preferências de perfil, voz, aparência e conexão. Tudo é salvo apenas neste navegador.
          </p>
        </header>

        <SectionCard id="settings-profile" title="PERFIL" icon={User}>
          <label htmlFor="settings-display-name" className="block text-2xs text-muted">
            Como a NEXA deve chamar você
          </label>
          <input
            id="settings-display-name"
            value={settings.displayName}
            maxLength={60}
            onChange={(event) => update({ displayName: event.target.value })}
            className="w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/40"
          />
        </SectionCard>

        <SectionCard id="settings-voice" title="VOZ" icon={Mic}>
          <SettingSwitch
            label="Entrada por voz"
            description={
              voiceInputSupported
                ? 'Segure o microfone no composer para falar.'
                : 'Indisponível neste navegador; use o campo de texto.'
            }
            checked={settings.voiceInputEnabled}
            onChange={(checked) => update({ voiceInputEnabled: checked })}
          />

          <SettingSwitch
            label="Ler respostas em voz alta"
            description={
              speechSupported
                ? 'A síntese usa a voz do sistema e fica desligada por padrão.'
                : 'Síntese de voz indisponível neste navegador.'
            }
            checked={settings.ttsEnabled}
            onChange={(checked) => {
              if (!checked) cancelSpeech();
              update({ ttsEnabled: checked });
            }}
            disabled={!speechSupported}
          />

          <div>
            <label htmlFor="settings-speech-voice" className="block text-2xs text-muted">
              Voz em português
            </label>
            <select
              id="settings-speech-voice"
              value={settings.speechVoiceURI}
              disabled={!settings.ttsEnabled || voices.length === 0}
              onChange={(event) => update({ speechVoiceURI: event.target.value })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40 disabled:opacity-40"
            >
              <option value="">Padrão do sistema</option>
              {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>)}
            </select>
            <button
              type="button"
              onClick={() => speakText('Olá. Esta é a voz selecionada para a NEXA.')}
              disabled={!settings.ttsEnabled || !speechSupported}
              className="mt-2 min-h-11 rounded-lg border border-white/10 px-3 font-mono text-2xs uppercase tracking-[0.1em] text-muted disabled:opacity-40"
            >Testar voz</button>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="settings-speech-rate" className="text-2xs text-muted">
                Velocidade da voz
              </label>
              <span className="font-mono text-2xs text-primary">
                {settings.speechRate.toFixed(1)}x
              </span>
            </div>
            <input
              id="settings-speech-rate"
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.speechRate}
              disabled={!settings.ttsEnabled}
              onChange={(event) => update({ speechRate: Number(event.target.value) })}
              className="mt-1 w-full accent-primary disabled:opacity-40"
            />
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-white/5 bg-background/30 p-2.5 font-mono text-2xs uppercase leading-relaxed tracking-[0.1em] text-muted/70">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" aria-hidden="true" />
            No Chrome, o reconhecimento pode enviar áudio aos servidores do navegador. Evite falar
            dados sensíveis.
          </p>
        </SectionCard>

        <SectionCard id="settings-appearance" title="APARÊNCIA" icon={Palette}>
          <SettingSwitch
            label="Reduzir animações"
            description="Desliga pulsos, giros e transições do HUD."
            checked={settings.reducedMotion}
            onChange={(checked) => update({ reducedMotion: checked })}
          />
        </SectionCard>

        <SectionCard id="settings-account" title="CONTA" icon={ShieldCheck}>
          <AccountSettings />
        </SectionCard>

        <SectionCard id="settings-connection" title="CONEXÃO" icon={Plug}>
          <div>
            <label htmlFor="settings-api-url" className="block text-2xs text-muted">
              URL base da API
            </label>
            <input
              id="settings-api-url"
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
              placeholder="/api/v1"
              className="mt-1 w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2 font-mono text-xs text-foreground outline-none transition focus:border-primary/40"
            />
            <p className="mt-1 text-2xs leading-relaxed text-muted/70">
              Use <code>/api/v1</code> para o proxy local ou a URL completa do backend. Nenhuma
              chave de API é armazenada no frontend.
            </p>
          </div>

          <SettingSwitch
            label="Modo demonstração"
            description="Respostas simuladas localmente, sem chamadas externas."
            checked={demoMode}
            onChange={setDemoMode}
          />

          {connectionError && (
            <p role="alert" className="text-2xs text-danger">
              {connectionError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyConnection}
              disabled={!connectionDirty}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              Aplicar e recarregar
            </button>
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted/60">
              {connectionDirty ? 'alterações pendentes' : 'sem alterações'}
            </span>
          </div>
        </SectionCard>

        <SectionCard id="settings-offline" title="MODO OFFLINE (OLLAMA)" icon={Plug}>
          <div><label htmlFor="settings-ollama-url" className="block text-2xs text-muted">URL local</label><input id="settings-ollama-url" value={ollamaUrl} onChange={(event) => setOllamaConfig(event.target.value, numCtx)} className="mt-1 w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2 font-mono text-xs text-foreground" /><p className="mt-1 text-2xs text-muted/70">Use /ollama para acessar pelo proxy same-origin, inclusive quando a Web é aberta pelo IP da rede. URLs diretas aceitam somente localhost ou loopback.</p></div>
          <div><label htmlFor="settings-ollama-context" className="block text-2xs text-muted">Contexto (num_ctx)</label><input id="settings-ollama-context" type="number" min={512} max={131072} step={512} value={numCtx} onChange={(event) => setOllamaConfig(ollamaUrl, Math.max(512, Number(event.target.value) || 4096))} className="mt-1 w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2 font-mono text-xs text-foreground" /></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setOllamaError(null); setOllamaStatus(null); void ollamaVersion().then((version) => setOllamaStatus(`Ollama ${version} conectado`)).catch((error: unknown) => setOllamaError(error instanceof Error ? error.message : 'Falha ao conectar.')); }} className="min-h-11 rounded-xl border border-white/10 px-3 font-mono text-2xs uppercase text-muted hover:text-primary">Testar conexão</button><button type="button" onClick={() => { if (connectionMode === 'offline') { setConnectionMode('api'); useAuthStore.getState().clear(); } else setConnectionMode('offline'); }} className="min-h-11 rounded-xl border border-primary/35 bg-primary/10 px-3 font-mono text-2xs uppercase text-primary">{connectionMode === 'offline' ? 'Sair do offline' : 'Entrar no offline'}</button></div>
          {ollamaStatus && <p role="status" className="text-2xs text-success">{ollamaStatus}</p>}{ollamaError && <p role="alert" className="text-2xs text-danger">{ollamaError}</p>}
        </SectionCard>

        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <p className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.12em] text-muted/60">
            <AudioLines className="h-3 w-3" aria-hidden="true" />
            Preferências salvas em localStorage
          </p>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted transition hover:border-danger/30 hover:text-danger"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Restaurar padrões
          </button>
        </div>

        <p className="flex items-center gap-1.5 pb-2 font-mono text-2xs uppercase tracking-[0.1em] text-muted/50">
          <Volume2 className="h-3 w-3" aria-hidden="true" />
          TTS desligado por padrão
        </p>
      </div>
    </section>
  );
}
