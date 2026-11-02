import { createId } from '@/lib/id';

import type { ChatStorage } from '../storage/types';
import type { ChatMessage, MessageStatus, Session } from '../types';
import type { AttachmentMeta } from '../types';
import type { AttachmentStore, StoredAttachment } from '@/features/chat/attachments/store';

export interface LocalChatRepository {
  listSessions(): Promise<Session[]>;
  createSession(title?: string): Promise<Session>;
  renameSession(id: string, title: string): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  listMessages(id: string): Promise<ChatMessage[]>;
  getAttachment(id: string): Promise<StoredAttachment | undefined>;
  /** Grava a mensagem do usuário + um placeholder 'streaming' (e remove a troca com erro em retry). */
  beginExchange(sessionId: string, userContent: string, attachments?: AttachmentMeta[], blobs?: Map<string, StoredAttachment>): Promise<{ assistantId: string }>;
  finishAssistant(
    sessionId: string,
    assistantId: string,
    patch: { content: string; status: MessageStatus; memoriesUsed?: number; skillsUsed?: number },
  ): Promise<void>;
}

export interface LocalChatRepositoryOptions {
  storage?: ChatStorage;
  /** Cria a conversa "Boas-vindas" quando não há histórico. */
  seed?: boolean;
  attachmentStore?: AttachmentStore;
}

function freshSession(id: string, title: string): Session {
  const now = new Date().toISOString();
  return { id, title, createdAt: now, updatedAt: now };
}

/**
 * Histórico local (IndexedDB) usado pelos dois adaptadores. A API NEXA não
 * guarda conversas: o navegador é a fonte das sessões e mensagens.
 */
export class IndexedDbChatRepository implements LocalChatRepository {
  private readonly sessions = new Map<string, Session>();
  private readonly messages = new Map<string, ChatMessage[]>();
  private ready: Promise<void> | null = null;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: LocalChatRepositoryOptions = {}) {}

  listSessions(): Promise<Session[]> {
    return this.withReady(() =>
      [...this.sessions.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((session) => ({ ...session })),
    );
  }

  createSession(title = 'Nova conversa'): Promise<Session> {
    return this.withReady(async () => {
      const session = freshSession(createId('sess'), title);
      this.sessions.set(session.id, session);
      this.messages.set(session.id, []);
      await this.persistNow();

      return { ...session };
    });
  }

  renameSession(sessionId: string, title: string): Promise<Session> {
    return this.withReady(async () => {
      const trimmed = title.trim();

      if (!trimmed) {
        throw new Error('O título da conversa não pode ficar vazio.');
      }

      const session = this.sessions.get(sessionId);

      if (!session) {
        throw new Error(`Sessão "${sessionId}" não encontrada.`);
      }

      session.title = trimmed;
      session.updatedAt = new Date().toISOString();
      await this.persistNow();

      return { ...session };
    });
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.withReady(async () => {
      if (!this.sessions.has(sessionId)) {
        throw new Error(`Sessão "${sessionId}" não encontrada.`);
      }

      const ids = (this.messages.get(sessionId) ?? []).flatMap((message) => message.attachments?.map((item) => item.id) ?? []);
      await this.options.attachmentStore?.deleteMany(ids);
      this.sessions.delete(sessionId);
      this.messages.delete(sessionId);
      await this.persistNow();
    });
  }

  listMessages(sessionId: string): Promise<ChatMessage[]> {
    return this.withReady(() =>
      (this.messages.get(sessionId) ?? []).map((message) => ({ ...message })),
    );
  }

  getAttachment(id: string): Promise<StoredAttachment | undefined> {
    return this.options.attachmentStore?.get(id) ?? Promise.resolve(undefined);
  }

  beginExchange(sessionId: string, userContent: string, attachments: AttachmentMeta[] = [], blobs?: Map<string, StoredAttachment>): Promise<{ assistantId: string }> {
    return this.withReady(async () => {
      const session = this.sessions.get(sessionId);

      if (!session) {
        throw new Error(`Sessão "${sessionId}" não encontrada.`);
      }

      const history = this.messages.get(sessionId) ?? [];
      const previous = history.at(-1);
      const previousUser = history.at(-2);

      // Em um retry, substitui a última troca que falhou em vez de duplicá-la.
      if (
        previous?.role === 'assistant' &&
        previous.status === 'error' &&
        previousUser?.role === 'user' &&
        previousUser.content === userContent &&
        JSON.stringify(previousUser.attachments?.map((item) => item.id) ?? []) === JSON.stringify(attachments.map((item) => item.id))
      ) {
        history.splice(-2, 2);
      }

      for (const attachment of attachments) {
        const existing = await this.options.attachmentStore?.get(attachment.id);
        const value = blobs?.get(attachment.id);
        if (!existing && value) await this.options.attachmentStore?.put(attachment.id, value);
      }

      const createdAt = new Date().toISOString();
      const assistantId = createId('msg');

      history.push(
        {
          id: createId('msg'),
          role: 'user',
          content: userContent,
          createdAt,
          status: 'done',
          ...(attachments.length ? { attachments: attachments.map((item) => ({ ...item })) } : {}),
        },
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt,
          status: 'streaming',
        },
      );

      this.messages.set(sessionId, history);
      this.touchSession(sessionId);
      await this.persistNow();

      return { assistantId };
    });
  }

  finishAssistant(
    sessionId: string,
    assistantId: string,
    patch: { content: string; status: MessageStatus; memoriesUsed?: number; skillsUsed?: number },
  ): Promise<void> {
    return this.withReady(async () => {
      const history = this.messages.get(sessionId) ?? [];

      this.messages.set(
        sessionId,
        history.map((message) =>
          message.id === assistantId
            ? { ...message, content: patch.content, status: patch.status, ...(patch.memoriesUsed !== undefined ? { memoriesUsed: patch.memoriesUsed } : {}), ...(patch.skillsUsed !== undefined ? { skillsUsed: patch.skillsUsed } : {}) }
            : message,
        ),
      );

      this.touchSession(sessionId);
      await this.persistNow();
    });
  }

  private async withReady<T>(action: () => T | Promise<T>): Promise<T> {
    await this.ensureReady();
    return action();
  }

  private ensureReady(): Promise<void> {
    this.ready ??= this.hydrate();
    return this.ready;
  }

  private async hydrate(): Promise<void> {
    if (!this.options.storage) {
      if (this.options.seed !== false) this.seed();
      return;
    }

    try {
      const snapshot = await this.options.storage.load();

      if (snapshot?.sessions?.length) {
        for (const session of snapshot.sessions) {
          this.sessions.set(session.id, session);
        }

        for (const [sessionId, messages] of Object.entries(snapshot.messages ?? {})) {
          this.messages.set(sessionId, messages);
        }

        return;
      }
    } catch (error) {
      console.warn('NEXA: falha ao carregar o histórico local.', error);
    }

    if (this.options.seed !== false) {
      this.seed();
      await this.persistNow();
    }
  }

  private seed(): void {
    const session = freshSession('boas-vindas', 'Boas-vindas');

    this.sessions.set(session.id, session);
    this.messages.set(session.id, [
      {
        id: 'msg-boas-vindas',
        role: 'assistant',
        content: 'NEXA online. Núcleo inicializado. Como posso ajudar?',
        createdAt: session.createdAt,
        status: 'done',
      },
    ]);
  }

  private async persistNow(): Promise<void> {
    const storage = this.options.storage;

    if (!storage) {
      return;
    }

    const snapshot = {
      sessions: [...this.sessions.values()].map((session) => ({ ...session })),
      messages: Object.fromEntries(
        [...this.messages.entries()].map(([sessionId, messages]) => [
          sessionId,
          messages.map((message) => ({ ...message })),
        ]),
      ),
    };

    this.persistQueue = this.persistQueue
      .catch(() => undefined)
      .then(() => storage.save(snapshot))
      .catch((error) => {
        console.warn('NEXA: falha ao salvar o histórico local.', error);
      });

    await this.persistQueue;
  }

  private touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.updatedAt = new Date().toISOString();
    }
  }
}

export function createLocalChatRepository(
  options: LocalChatRepositoryOptions = {},
): LocalChatRepository {
  return new IndexedDbChatRepository(options);
}
