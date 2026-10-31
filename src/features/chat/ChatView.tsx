import { useEffect, useState } from 'react';

import { AI_STATE_LABEL } from '@/features/assistant/ai-state';
import { Orb } from '@/features/assistant/Orb';
import { useSpeechRecognition } from '@/features/voice/use-speech-recognition';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatSessionTime } from '@/lib/format';
import { notify } from '@/stores/notification-store';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useModels } from '@/api/models';
import { useModelStore } from '@/stores/model-store';

import { useChat } from './use-chat';
import { useSessions } from './api';
import { Composer } from './Composer';
import { MessageList } from './MessageList';

export function ChatView({ sessionId }: { sessionId: string | null }) {
  const {
    messages,
    isLoading,
    isError,
    isStreaming,
    aiState,
    error,
    sendBlockedByNetwork,
    sendMessage,
    stop,
    retry,
    retryLast,
    // Novos estados da F7.3
    modelFromStream,
    finishReasonFromStream,
  } = useChat(sessionId);
  const sessions = useSessions();
  const online = useOnlineStatus();
  const session = sessions.data?.find((item) => item.id === sessionId);
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const models = useModels();
  const selectedModelId = useModelStore((state) => state.selectedModelId);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  const voiceInputEnabled = useSettingsStore((state) => state.settings.voiceInputEnabled);
  const role = useAuthStore((state) => state.session?.role ?? 'guest');
  const maxMessageChars = role === 'admin' ? 8000 : 2000;
  const setAiState = useUiStore((state) => state.setAiState);
  const [draft, setDraft] = useState('');

  const voice = useSpeechRecognition({
    onFinal: (text) => {
      setDraft((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text));
    },
    onError: (message) => {
      notify({ tone: 'error', title: 'Entrada por voz', message });
    },
  });

  useEffect(() => {
    if (voice.listening) {
      if (useUiStore.getState().aiState === 'idle') {
        setAiState('listening');
      }

      return;
    }

    if (useUiStore.getState().aiState === 'listening') {
      setAiState('idle');
    }
  }, [setAiState, voice.listening]);

  useEffect(() => {
    return () => {
      if (useUiStore.getState().aiState === 'listening') {
        setAiState('idle');
      }
    };
  }, [setAiState]);

  return (
    <section aria-label="Conversa" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/5 bg-background/40 px-3 py-2 sm:px-5">
        <Orb state={aiState} size="sm" className="shrink-0" />

        <div className="min-w-0">
          <h2 className="truncate font-display text-[12px] tracking-[0.18em] text-foreground">
            {session?.title ?? 'Nova conversa'}
          </h2>
          <p
            role="status"
            aria-live="polite"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/80"
          >
            {offlineMode && aiState === 'processing' ? 'carregando modelo' : AI_STATE_LABEL[aiState]}
            {session ? ` · ${formatSessionTime(session.updatedAt)}` : ''}
          </p>
        </div>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {offlineMode && (
            <label className="sr-only" htmlFor="ollama-model-picker">Modelo Ollama</label>
          )}
          {offlineMode && (
            <select
              id="ollama-model-picker"
              aria-label="Modelo Ollama"
              value={selectedModelId ?? ''}
              onChange={(event) => setSelectedModel(event.target.value || null)}
              disabled={!models.data?.models.length}
              className="max-w-48 rounded-full border border-white/10 bg-background px-2.5 py-1 font-mono text-[10px] text-foreground"
            >
              <option value="">Automático</option>
              {(models.data?.models ?? []).map((model) => <option key={model.model_id} value={model.model_id}>{model.name}</option>)}
            </select>
          )}
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {offlineMode ? (modelFromStream ?? 'ollama local') : demoMode ? 'nexa-mock-1' : 'nexa-remote'}
          </span>
          <span className="rounded-full border border-success/20 bg-success/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-success">
            {offlineMode ? 'offline' : demoMode ? 'demo' : 'online'}
          </span>
          {modelFromStream && (
            <span className="ml-2 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
              {modelFromStream}
            </span>
          )}
          {finishReasonFromStream && (
            <span className="ml-2 rounded-full border border-warning/20 bg-warning/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-warning">
              {finishReasonFromStream}
            </span>
          )}
        </div>
      </div>

      <MessageList
        messages={messages}
        isLoading={isLoading}
        isError={isError}
        error={error}
        disabled={sendBlockedByNetwork}
        onRetry={retry}
        onRetryLast={retryLast}
        onSuggestion={(value) => void sendMessage(value)}
      />

      {offlineMode && models.isError && (
        <div role="status" className="border-t border-warning/20 bg-warning/5 px-4 py-2 text-center font-mono text-[10px] text-warning">
          {models.error instanceof Error ? models.error.message : 'Não foi possível consultar o Ollama.'}
          <button type="button" onClick={() => void models.refetch()} className="ml-3 underline">Tentar novamente</button>
        </div>
      )}
      {offlineMode && models.data && models.data.models.length === 0 && (
        <div role="status" className="border-t border-warning/20 bg-warning/5 px-4 py-2 text-center font-mono text-[10px] text-warning">
          Nenhum modelo local instalado. Execute <code>ollama pull llama3.1</code>.
        </div>
      )}

      {!online && !offlineMode && (
        <div
          role="status"
          className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-warning/20 bg-warning/5 px-4 py-2"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-warning">
            {demoMode
              ? 'Sem conexão · o modo demonstração continua local'
              : 'Sem conexão · envio pausado até a rede voltar'}
          </p>
          {!demoMode && (
            <button
              type="button"
              onClick={() => {
                retry();
                void sessions.refetch();
              }}
              className="rounded-lg border border-warning/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-warning transition hover:bg-warning/10"
            >
              Tentar agora
            </button>
          )}
        </div>
      )}

      <Composer
        disabled={!sessionId || isLoading || isError || sendBlockedByNetwork || (offlineMode && (!models.data?.models.length || models.isLoading))}
        disabledHint={sendBlockedByNetwork ? 'Sem conexão — aguardando a rede…' : undefined}
        isStreaming={isStreaming}
        value={draft}
        onValueChange={setDraft}
        onSend={(value) => {
          setDraft('');
          void sendMessage(value);
        }}
        onStop={stop}
        voiceEnabled={voiceInputEnabled}
        voiceSupported={voice.supported}
        listening={voice.listening}
        interim={voice.interim}
        voiceError={voice.error}
        onVoiceStart={voice.start}
        onVoiceStop={voice.stop}
        onVoiceCancel={voice.cancel}
        maxLength={maxMessageChars}
      />
    </section>
  );
}
