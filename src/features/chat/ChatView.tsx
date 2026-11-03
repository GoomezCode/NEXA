import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSpeechRecognition } from '@/features/voice/use-speech-recognition';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { notify } from '@/stores/notification-store';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useUiStore } from '@/stores/ui-store';
import { useModels } from '@/api/models';
import { getChatAdapter } from '@/api';
import type { ChatAdapter } from '@/api/types';

import { useChat } from './use-chat';
import { useCreateSession, useRenameSession, useSessions } from './api';
import { Composer, type PendingAttachment } from './Composer';
import { MessageList } from './MessageList';

const VoiceCallProvider = lazy(() => import('@/features/voice/VoiceCallProvider').then((module) => ({ default: module.VoiceCallProvider })));

export function ChatView({ sessionId }: { sessionId: string | null }) {
  const navigate = useNavigate();
  const createSession = useCreateSession();
  const renameSession = useRenameSession();
  const pendingSend = useRef<{ sessionId: string; content: string; attachments: PendingAttachment[]; adapter: ChatAdapter; voiceCall: boolean } | null>(null);
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

  useEffect(() => {
    const pending = pendingSend.current;
    if (!sessionId || !pending || pending.sessionId !== sessionId) return;
    pendingSend.current = null;
    void sendMessage(pending.content, pending.attachments, pending.adapter, pending.voiceCall);
  }, [sendMessage, sessionId]);

  const send = async (content: string, attachments: PendingAttachment[] = [], voiceCall = false) => {
    const titleSource = content.trim() || attachments[0]?.meta.name || '';
    const title = titleSource.replace(/\s+/g, ' ').slice(0, 80).trim();

    if (sessionId) {
      if (messages.length === 0 && session?.title === 'Nova conversa' && title) {
        try {
          await renameSession.mutateAsync({ sessionId, title });
        } catch {
          notify({ tone: 'error', title: 'Nome da conversa', message: 'Não foi possível definir o nome automaticamente. Você pode renomear pela lista de conversas.' });
        }
      }
      void sendMessage(content, attachments, undefined, voiceCall);
      return;
    }

    try {
      const adapter = getChatAdapter();
      const session = await createSession.mutateAsync(title || undefined);
      pendingSend.current = { sessionId: session.id, content, attachments, adapter, voiceCall };
      navigate(`/c/${session.id}`);
    } catch {
      notify({ tone: 'error', title: 'Nova conversa', message: 'Não foi possível criar uma conversa.' });
    }
  };

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
  const voiceCallEnabled = useSettingsStore((state) => state.settings.voiceCallEnabled);

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
        onSuggestion={(value) => void send(value)}
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

      {(() => {
        const composer = <Composer
        disabled={createSession.isPending || isLoading || isError || sendBlockedByNetwork || (offlineMode && (!models.data?.models.length || models.isLoading))}
        disabledHint={sendBlockedByNetwork ? 'Sem conexão — aguardando a rede…' : undefined}
        isStreaming={isStreaming}
        value={draft}
        onValueChange={setDraft}
        onSend={(value) => {
          setDraft('');
          void send(value);
        }}
        onSendAttachments={(value, attachments) => { setDraft(''); void send(value, attachments); }}
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
      />;
        return voiceCallEnabled && !offlineMode && !demoMode ? <Suspense fallback={composer}><VoiceCallProvider onTranscript={(text) => { void send(text, [], true); }} onInterrupt={stop} isBusy={isStreaming}>{composer}</VoiceCallProvider></Suspense> : composer;
      })()}
    </section>
  );
}
