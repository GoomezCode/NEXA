import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import { useSpeechRecognition } from '@/features/voice/use-speech-recognition';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { notify } from '@/stores/notification-store';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useModels } from '@/api/models';

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
  const session = sessions.data?.find((item) => item.id === sessionId);
  const online = useOnlineStatus();
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const models = useModels();
  const voiceInputEnabled = useSettingsStore((state) => state.settings.voiceInputEnabled);
  const role = useAuthStore((state) => state.session?.role ?? 'guest');
  const maxMessageChars = offlineMode || role === 'admin' ? undefined : 2000;
  const setAiState = useUiStore((state) => state.setAiState);
  const [draft, setDraft] = useState('');
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const dragDepth = useRef(0);

  const hasFiles = (event: DragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes('Files');

  useEffect(() => {
    const handleAttachmentError = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      setAttachmentNotice(message);
      notify({ tone: 'error', title: 'Anexo não adicionado', message });
    };
    window.addEventListener('nexa-attachment-error', handleAttachmentError);
    return () => window.removeEventListener('nexa-attachment-error', handleAttachmentError);
  }, []);

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
    <section
      aria-label="Conversa"
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDraggingFiles(true);
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return;
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) { dragDepth.current = 0; setDraggingFiles(false); }
      }}
      onDragOver={(event) => { if (hasFiles(event)) event.preventDefault(); }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDraggingFiles(false);
        setDroppedFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {draggingFiles && <div aria-hidden="true" className="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-surface/90 text-lg text-primary">Solte para anexar</div>}
      <h2 className="sr-only sm:not-sr-only sm:mx-auto sm:mt-3 sm:block sm:w-full sm:max-w-[760px] sm:px-6 sm:text-xs sm:font-medium sm:text-muted">
        {session?.title ?? 'Nova conversa'}
      </h2>
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
        disabled={!sessionId || isLoading || isError || sendBlockedByNetwork || (offlineMode && (!models.data?.models.length || models.isLoading))}
        disabledHint={sendBlockedByNetwork ? 'Sem conexão — aguardando a rede…' : undefined}
        isStreaming={isStreaming}
        value={draft}
        onValueChange={setDraft}
        onSend={(value) => {
          setDraft('');
          void sendMessage(value);
        }}
        onSendAttachments={(value, attachments) => { setDraft(''); void sendMessage(value, attachments); }}
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
        attachmentNotice={attachmentNotice}
        apiMode={!offlineMode && !demoMode}
        externalFiles={droppedFiles}
        onAttachmentsChange={(items) => { setAttachmentNotice(items.length ? `${items.length} anexos adicionados` : ''); }}
      />
    </section>
  );
}
