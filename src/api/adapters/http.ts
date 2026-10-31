import { fitContext, limitsFor } from '@/features/chat/context';
import { useAuthStore } from '@/stores/auth-store';
import { buildPersonalization } from '@/features/chat/personalization';

import { streamChat } from '../chat';
import { ApiError } from '../client/problem';
import type { ChatAdapter, ChatMessage, ChatStreamEvent, ChatStreamInput, Session } from '../types';
import type { LocalChatRepository } from './local-chat';

export { ApiError } from '../client/problem';

/**
 * Conversa real: o histórico fica no navegador (a API não guarda sessões) e
 * cada resposta é enviada como a lista completa de mensagens em streaming.
 */
export class HttpChatAdapter implements ChatAdapter {
  constructor(private readonly repo: LocalChatRepository) {}

  listSessions(): Promise<Session[]> {
    return this.repo.listSessions();
  }

  createSession(title?: string): Promise<Session> {
    return this.repo.createSession(title);
  }

  renameSession(id: string, title: string): Promise<Session> {
    return this.repo.renameSession(id, title);
  }

  deleteSession(id: string): Promise<void> {
    return this.repo.deleteSession(id);
  }

  listMessages(id: string): Promise<ChatMessage[]> {
    return this.repo.listMessages(id);
  }

  async *streamReply({
    sessionId,
    content,
    signal,
    modelId,
    personalization: suppliedPersonalization,
  }: ChatStreamInput): AsyncIterable<ChatStreamEvent> {
    const { assistantId } = await this.repo.beginExchange(sessionId, content);
    const role = useAuthStore.getState().session?.role ?? 'guest';
    const messages = fitContext(await this.repo.listMessages(sessionId), limitsFor(role));
    const personalization = suppliedPersonalization ?? await buildPersonalization(content);
    let text = '';

    try {
      for await (const event of streamChat({ messages, modelId, signal, personalization })) {
        if (event.type === 'token') text += event.value;
        yield event;
        if (event.type === 'error') {
          throw new ApiError(0, event.message, undefined, {
            code: event.code,
            requestId: event.requestId,
          });
        }
      }

      await this.repo.finishAssistant(sessionId, assistantId, { content: text, status: 'done', memoriesUsed: personalization.memories.length });
    } catch (error) {
      await this.repo.finishAssistant(sessionId, assistantId, {
        content: text,
        status: signal.aborted ? 'stopped' : 'error',
      });
      throw error;
    }
  }
}
