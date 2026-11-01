import {
  AudioLines,
  Gauge,
  LogOut,
  Mic,
  Palette,
  Plug,
  RotateCcw,
  ShieldCheck,
  Settings2,
  User,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { logout } from '@/api/auth';
import { isSpeechRecognitionSupported } from '@/features/voice/use-speech-recognition';
import { cancelSpeech, isSpeechSynthesisSupported, speakText } from '@/lib/speech';
import { useAuthStore } from '@/stores/auth-store';
import { useConnectionStore } from '@/stores/connection-store';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settings-store';
import { resetChatAdapter } from '@/api';
import { SectionCard } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Switch as SettingSwitch } from '@/components/ui/Switch';
import { ProviderKeysPanel } from '@/features/monitor/ProviderKeysPanel';
import { OllamaSettings } from './OllamaSettings';

const profileSchema = z.object({ displayName: z.string().trim().max(60, 'Use até 60 caracteres.') });

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
  const settings = useSettingsStore((state) => state.settings);
  const accountName = useAuthStore((state) => state.session?.username ?? '');
  const update = useSettingsStore((state) => state.update);
  const reset = useSettingsStore((state) => state.reset);

  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [demoMode, setDemoMode] = useState(settings.demoMode);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: settings.displayName },
  });
  const resetProfile = profileForm.reset;

  const voiceInputSupported = isSpeechRecognitionSupported();
  const speechSupported = isSpeechSynthesisSupported();
  useEffect(() => {
    resetProfile({ displayName: settings.displayName });
  }, [resetProfile, settings.displayName]);

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
    resetProfile({ displayName: DEFAULT_SETTINGS.displayName });
  };

  return (
    <section aria-label="Ajustes" className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24">
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

        <nav aria-label="Seções dos ajustes" className="sticky top-0 z-10 flex gap-1 overflow-x-auto rounded-xl border border-border/70 bg-background/95 p-1 backdrop-blur-xl">
          {[
            ['settings-profile', 'Perfil'], ['settings-voice', 'Voz'], ['settings-appearance', 'Aparência'],
            ['settings-account', 'Conta'], ['settings-providers', 'Provedores'], ['settings-connection', 'Conexão'], ['settings-offline', 'Offline'],
          ].map(([id, label]) => <a key={id} href={`#${id}`} className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 font-mono text-2xs uppercase tracking-wider text-muted hover:bg-primary/10 hover:text-primary">{label}</a>)}
        </nav>

        <SectionCard id="settings-profile" title="PERFIL" icon={User}>
          <form onSubmit={profileForm.handleSubmit(({ displayName }) => update({ displayName }))} className="space-y-2">
            <Field id="settings-display-name" label="Como a NEXA deve chamar você" placeholder={accountName || 'Seu nome'} maxLength={60} aria-invalid={Boolean(profileForm.formState.errors.displayName)} {...profileForm.register('displayName')} />
            {profileForm.formState.errors.displayName && <p role="alert" className="text-xs text-danger">{profileForm.formState.errors.displayName.message}</p>}
            <Button type="submit" variant="primary" disabled={!profileForm.formState.isDirty}>Salvar perfil</Button>
          </form>
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
          <div>
            <label htmlFor="settings-theme" className="block text-2xs text-muted">Tema da interface</label>
            <select
              id="settings-theme"
              value={settings.theme}
              onChange={(event) => update({ theme: event.target.value as typeof settings.theme })}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-background/60 px-3 text-sm text-foreground outline-none focus:border-primary/40"
            >
              <option value="hud">NEXA HUD</option>
              <option value="violet">Violeta</option>
              <option value="rose">Rosa</option>
              <option value="classic">Clássico</option>
              <option value="light">Claro</option>
              <option value="contrast">Alto contraste</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-effects" className="block text-xs text-muted">Efeitos visuais</label>
            <select id="settings-effects" value={settings.effectsMode} onChange={(event) => update({ effectsMode: event.target.value as typeof settings.effectsMode })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/60 px-3 text-base text-foreground outline-none focus:border-primary/40 sm:text-sm">
              <option value="auto">Automático</option>
              <option value="full">Completo</option>
              <option value="balanced">Equilibrado</option>
              <option value="lite">Econômico</option>
            </select>
            <p className="mt-1 text-xs text-muted">Automático reduz blur e animações em aparelhos limitados ou com economia de dados.</p>
          </div>
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

        <SectionCard id="settings-providers" title="PROVEDORES DE IA" icon={Settings2}>
          <p className="text-xs leading-relaxed text-muted">Configure chaves próprias para usar provedores de IA.</p>
          <ProviderKeysPanel />
        </SectionCard>

        <SectionCard id="settings-connection" title="CONEXÃO" icon={Plug}>
          <div>
            <Field
              id="settings-api-url"
              label="URL base da API"
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
              placeholder="/api/v1"
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
            <Button
              type="button"
              variant="primary"
              onClick={applyConnection}
              disabled={!connectionDirty}
              className="font-mono text-2xs uppercase tracking-[0.12em]"
            >
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              Aplicar conexão
            </Button>
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted/60">
              {connectionDirty ? 'alterações pendentes' : 'sem alterações'}
            </span>
          </div>
        </SectionCard>

        <OllamaSettings />

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
