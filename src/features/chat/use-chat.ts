import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getChatAdapter } from '@/api';
import { describeError } from '@/api/errors';
import type { AiState, ChatMessage } from '@/api/types';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { createId } from '@/lib/id';
import { cancelSpeech, SpeechStreamer, type SpeechEngine } from '@/lib/speech';
import { notify } from '@/stores/notification-store';
import { useModelStore } from '@/stores/model-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';
import { useSessionMetricsStore } from '@/stores/session-metrics-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useStreamStore } from '@/stores/stream-store';
import { buildPersonalization } from './personalization';

import { messageKeys, sessionKeys, useMessages } from './api';

export interface UseChatResult {
  messages: ChatMessage[];
  isLoading: boolean;
  isError: boolean;
  isStreaming: boolean;
  aiState: AiState;
  error: string | null;
  /** Envio pausado por falta de rede fora do modo demonstração. */
  sendBlockedByNetwork: boolean;
  sendMessage: (content: string) => Promise<void>;
  stop: () => void;
  retry: () => void;
  retryLast: () => void;
  /** Modelo da última resposta do assistente (vindo do stream). */
  modelFromStream: string | undefined;
  /** finish_reason da última resposta (stop/length/timeout/tool_use). */
  finishReasonFromStream: string | undefined;
  /** usage (input/output tokens) da última resposta. */
  usageFromStream: { input?: number; output?: number } | undefined;
}

export function useChat(sessionId: string | null): UseChatResult {
  const queryClient = useQueryClient();
  const messagesQuery = useMessages(sessionId);
  const aiState = useUiStore((state) => state.aiState);
  const setAiState = useUiStore((state) => state.setAiState);
  const online = useOnlineStatus();
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const sendBlockedByNetwork = !offlineMode && !online && !demoMode;
  const [isStreaming, setIsStreaming] = useState(false);
  const [modelFromStream, setModelFromStream] = useState<string | undefined>(undefined);
  const [finishReasonFromStream, setFinishReasonFromStream] = useState<string | undefined>(
    undefined,
  );
  const [usageFromStream, setUsageFromStream] = useState<
    { input?: number; output?: number } | undefined
  >(undefined);
  const [errorState, setErrorState] = useState<{ sessionId: string; message: string } | null>(
    null,
  );
  const error = errorState?.sessionId === sessionId ? errorState.message : null;
  const abortRef = useRef<AbortController | null>(null);
  const speechRef = useRef<SpeechEngine | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      speechRef.current?.cancel();
      speechRef.current = null;
      cancelSpeech();
    };
  }, [sessionId]);

  const updateMessages = useCallback(
    (update: (current: ChatMessage[]) => ChatMessage[]) => {
      if (!sessionId) {
        return;
      }

      queryClient.setQueryData<ChatMessage[]>(messageKeys.session(sessionId), (current = []) =>
        update(current),
      );
    },
    [queryClient, sessionId],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();

      if (
        !trimmed ||
        !sessionId ||
        abortRef.current ||
        messagesQuery.isLoading ||
        messagesQuery.isError ||
        sendBlockedByNetwork
      ) {
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const assistantId = createId('msg');
      const createdAt = new Date().toISOString();

      cancelSpeech();
      const responseStartedAt = performance.now();
      let firstTokenAt: number | undefined;
      let responseUsage: { input?: number; output?: number } | undefined;
      let responseFinishReason: string | undefined;
      let responseModelId: string | undefined;
      let responseKeySource: 'server' | 'user' | undefined;
      setErrorState(null);
      setModelFromStream(undefined);
      setFinishReasonFromStream(undefined);
      setUsageFromStream(undefined);
      setIsStreaming(true);
      setAiState('processing');
      useStreamStore.getState().begin(assistantId);
      let personalization: Awaited<ReturnType<typeof buildPersonalization>> = { memories: [] };
      // The stream must own a speech queue before the first token arrives. Without
      // this instance every push/finish below is a no-op, including the final tail.
      speechRef.current = new SpeechStreamer();
      let pendingContent = '';
      let streamContent = '';
      let pendingFlushTimer = 0;
      const flushContent = () => {
        if (pendingFlushTimer) window.clearTimeout(pendingFlushTimer);
        pendingFlushTimer = 0;
        const contentChunk = pendingContent;
        pendingContent = '';
        if (!contentChunk) return;
        streamContent += contentChunk;
        useStreamStore.getState().append(assistantId, contentChunk);
      };
      const queueContent = (value: string) => {
        pendingContent += value;
        if (!pendingFlushTimer) {
          pendingFlushTimer = window.setTimeout(flushContent, 33);
        }
      };

      updateMessages((current) => [
        ...current,
        {
          id: createId('msg'),
          role: 'user',
          content: trimmed,
          createdAt,
          status: 'done',
        },
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt,
          status: 'streaming',
        },
      ]);

      try {
        personalization = await buildPersonalization(trimmed);
        let receivedToken = false;

        for await (const event of getChatAdapter().streamReply({
          sessionId,
          content: trimmed,
          signal: controller.signal,
          modelId: useModelStore.getState().selectedModelId,
          personalization,
        })) {
          if (event.type === 'token') {
            if (!receivedToken) {
              receivedToken = true;
              firstTokenAt = performance.now();
              setAiState('responding');
            }

            speechRef.current?.push(event.value);
            queueContent(event.value);
          }

          if (event.type === 'done') {
            responseModelId = event.modelId;
            responseKeySource = event.keySource;
            responseFinishReason = event.finishReason;
            setModelFromStream(event.modelId);
            setFinishReasonFromStream(event.finishReason);
            setUsageFromStream(
                event.providerUsage &&
                  (typeof event.providerUsage.prompt_tokens === 'number' ||
                    typeof event.providerUsage.completion_tokens === 'number')
                  ? {
                      ...(typeof event.providerUsage.prompt_tokens === 'number'
                        ? { input: event.providerUsage.prompt_tokens }
                        : {}),
                      ...(typeof event.providerUsage.completion_tokens === 'number'
                        ? { output: event.providerUsage.completion_tokens }
                        : {}),
                    }
                  : undefined,
            );
            responseUsage = event.providerUsage ? {
              ...(typeof event.providerUsage.prompt_tokens === 'number' ? { input: event.providerUsage.prompt_tokens } : {}),
              ...(typeof event.providerUsage.completion_tokens === 'number' ? { output: event.providerUsage.completion_tokens } : {}),
            } : undefined;
          }

          if (event.type === 'error') {
            throw new Error(event.message);
          }
        }

        flushContent();
        updateMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: streamContent, memoriesUsed: personalization.memories.length, status: 'done' } : message,
          ),
        );
        setAiState('idle');
        speechRef.current?.finish();
        speechRef.current = null;
        useSessionMetricsStore.getState().record(sessionId, {
          ...(responseUsage?.input !== undefined ? { inputTokens: responseUsage.input } : {}),
          ...(responseUsage?.output !== undefined ? { outputTokens: responseUsage.output } : {}),
          ...(firstTokenAt !== undefined ? { firstTokenMs: firstTokenAt - responseStartedAt } : {}),
          durationMs: performance.now() - responseStartedAt,
          ...(responseUsage?.output !== undefined && firstTokenAt !== undefined
            ? { tokensPerSecond: responseUsage.output / Math.max((performance.now() - firstTokenAt) / 1000, 0.001) }
            : {}),
          ...(responseFinishReason ? { finishReason: responseFinishReason } : {}),
          ...(responseModelId ? { modelId: responseModelId } : {}),
          ...(responseKeySource ? { keySource: responseKeySource } : {}),
          recordedAt: Date.now(),
        });

        if (typeof document !== 'undefined' && document.hidden) {
          notify({
            tone: 'success',
            title: 'Resposta pronta',
            message: 'A NEXA concluiu a resposta.',
          });
        }
      } catch (caught) {
        flushContent();
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          updateMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, content: streamContent, status: 'stopped' } : message,
            ),
          );
          setAiState('idle');
          speechRef.current?.cancel();
          speechRef.current = null;
          return;
        }

        updateMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: streamContent, status: 'error' } : message,
          ),
        );

        const info = describeError(caught);
        setErrorState({ sessionId, message: info.message });
        setAiState('error');
        speechRef.current?.cancel();
        speechRef.current = null;
        notify({ tone: 'error', title: info.title, message: info.message });
      } finally {
        if (pendingFlushTimer) window.clearTimeout(pendingFlushTimer);
        useStreamStore.getState().clear(assistantId);
        setIsStreaming(false);
        abortRef.current = null;
        void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      }
    },
    [
      messagesQuery.isError,
      messagesQuery.isLoading,
      queryClient,
      sendBlockedByNetwork,
      sessionId,
      setAiState,
      updateMessages,
    ],
  );

  const stop = useCallback(() => {
    speechRef.current?.cancel();
    speechRef.current = null;
    cancelSpeech();
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    void messagesQuery.refetch();
  }, [messagesQuery]);

  const retryLast = useCallback(() => {
    if (sendBlockedByNetwork) {
      return;
    }

    const current = messagesQuery.data ?? [];
    let index = -1;

    for (let position = current.length - 1; position >= 0; position -= 1) {
      if (current[position]?.role === 'user') {
        index = position;
        break;
      }
    }

    const content = index >= 0 ? current[index]?.content : undefined;

    if (!content) {
      return;
    }

    updateMessages(() => current.slice(0, index));
    void sendMessage(content);
  }, [messagesQuery.data, sendBlockedByNetwork, sendMessage, updateMessages]);

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    isStreaming,
    aiState,
    error,
    sendBlockedByNetwork,
    sendMessage,
    stop,
    retry,
    retryLast,
    modelFromStream,
    finishReasonFromStream,
    usageFromStream,
  };
}
