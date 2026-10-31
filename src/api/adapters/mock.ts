import { createLocalChatRepository, type LocalChatRepository } from './local-chat';
import type { ChatStorage } from '../storage/types';
import type { ChatAdapter, ChatMessage, ChatStreamEvent, ChatStreamInput, Session } from '../types';

export interface MockChatAdapterOptions {
  /** Intervalo entre tokens. Útil para testes com 0. */
  tokenDelayMs?: number;
  /** Persistência opcional (IndexedDB no app, ausente nos testes). */
  storage?: ChatStorage;
  /** Simula uma falha na primeira resposta para validar o estado de erro. */
  failFirstStream?: boolean;
}

const STATUS_RESPONSE =
  'Núcleo NEXA operacional. Fundação carregada: React, TypeScript, Vite e Tailwind. ' +
  'Camada de API em modo demonstração. Nenhum erro detectado nos subsistemas.';

const HELP_RESPONSE =
  'Posso conversar, resumir informações e executar comandos do sistema. ' +
  'Nesta fase, o adaptador mock valida o streaming de respostas. ' +
  'Diga "status" para testar o núcleo.';

const IDENTITY_RESPONSE =
  'Eu sou a NEXA, sua interface neural. Estou em fase de fundação: ' +
  'o núcleo visual e a conversa real chegam nas próximas etapas.';

const DEFAULT_RESPONSE =
  'Entendi. Este é o adaptador de demonstração da NEXA. O texto está sendo ' +
  'transmitido em partes para validar o streaming que será usado com a API real.';

function abortError(): DOMException {
  return new DOMException('Requisição abortada.', 'AbortError');
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }

    const handleAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

/**
 * Adaptador local usado enquanto a API real não existe.
 * Simula latência, streaming token a token, cancelamento e persistência.
 */
export class MockChatAdapter implements ChatAdapter {
  private readonly repo: LocalChatRepository;
  private readonly tokenDelayMs: number;
  private failFirstStream: boolean;

  constructor(options: MockChatAdapterOptions = {}) {
    this.tokenDelayMs = options.tokenDelayMs ?? 22;
    this.failFirstStream = options.failFirstStream ?? false;
    this.repo = createLocalChatRepository({ storage: options.storage });
  }

  listSessions(): Promise<Session[]> {
    return this.repo.listSessions();
  }

  createSession(title = 'Nova conversa'): Promise<Session> {
    return this.repo.createSession(title);
  }

  renameSession(sessionId: string, title: string): Promise<Session> {
    return this.repo.renameSession(sessionId, title);
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.repo.deleteSession(sessionId);
  }

  listMessages(sessionId: string): Promise<ChatMessage[]> {
    return this.repo.listMessages(sessionId);
  }

  async *streamReply(input: ChatStreamInput): AsyncIterable<ChatStreamEvent> {
    if (this.failFirstStream) {
      this.failFirstStream = false;
      throw new Error('Falha simulada no adaptador de demonstração.');
    }

    if (input.signal.aborted) {
      throw abortError();
    }

    const { assistantId } = await this.repo.beginExchange(input.sessionId, input.content);

    const response = this.responseFor(input.content);
    const tokens = response.match(/\S+\s*/g) ?? [response];
    let text = '';

    try {
      yield { type: 'meta', model: 'nexa-mock-1' };

      for (const token of tokens) {
        await wait(this.tokenDelayMs, input.signal);

        if (input.signal.aborted) {
          throw abortError();
        }

        text += token;
        yield { type: 'token', value: token };
      }

      await this.repo.finishAssistant(input.sessionId, assistantId, {
        content: text,
        status: 'done',
      });

      yield {
        type: 'done',
        finishReason: 'stop',
        modelId: 'nexa-mock-1',
        providerUsage: {
          prompt_tokens: input.content.length,
          completion_tokens: text.length,
        },
      };
    } catch (error) {
      await this.repo.finishAssistant(input.sessionId, assistantId, {
        content: text,
        status: input.signal.aborted ? 'stopped' : 'error',
      });
      throw error;
    }
  }

  private responseFor(content: string): string {
    const text = content.toLowerCase();

    if (text.includes('status') || text.includes('sistema')) {
      return STATUS_RESPONSE;
    }

    if (text.includes('ajuda')) {
      return HELP_RESPONSE;
    }

    if (text.includes('quem') || text.includes('nexa')) {
      return IDENTITY_RESPONSE;
    }

    return DEFAULT_RESPONSE;
  }
}
