import { useEffect, useState } from 'react';

import { useSpeechRecognition } from '@/features/voice/use-speech-recognition';
import { useOnlineStatus } from '@/hooks/use-online-status';
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
    error,
    sendBlockedByNetwork,
    sendMessage,
    stop,
    retry,
    retryLast,
  } = useChat(sessionId);
  const sessions = useSessions();
  const online = useOnlineStatus();
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
        <div role="status" className="border-t border-warning/20 bg-warning/5 px-4 py-2 text-center font-mono text-2xs text-warning">
          {models.error instanceof Error ? models.error.message : 'Não foi possível consultar o Ollama.'}
          <button type="button" onClick={() => void models.refetch()} className="ml-3 underline">Tentar novamente</button>
        </div>
      )}
      {offlineMode && models.data && models.data.models.length === 0 && (
        <div role="status" className="border-t border-warning/20 bg-warning/5 px-4 py-2 text-center font-mono text-2xs text-warning">
          Nenhum modelo local instalado. Execute <code>ollama pull llama3.1</code>.
        </div>
      )}

      {!online && !offlineMode && (
        <div
          role="status"
          className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-warning/20 bg-warning/5 px-4 py-2"
        >
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-warning">
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
              className="rounded-lg border border-warning/30 px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.12em] text-warning transition hover:bg-warning/10"
            >
              Tentar agora
            </button>
          )}
        </div>
      )}

      <Composer
        modelOptions={offlineMode ? (models.data?.models ?? []).map((model) => ({ id: model.model_id, name: model.name })) : undefined}
        selectedModelId={selectedModelId}
        onModelChange={setSelectedModel}
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
