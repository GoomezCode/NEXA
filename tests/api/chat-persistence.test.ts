import { beforeEach, describe, expect, it } from 'vitest';

import { MockChatAdapter } from '@/api/adapters/mock';
import { clearPersistedChat, createIndexedDbChatStorage } from '@/api/storage/indexed-db';

describe('persistência do histórico no IndexedDB', () => {
  beforeEach(async () => {
    await clearPersistedChat();
  });

  it('recupera sessões e mensagens em uma nova instância do adaptador', async () => {
    const first = new MockChatAdapter({
      tokenDelayMs: 0,
      storage: createIndexedDbChatStorage(),
    });

    const session = await first.createSession('Conversa persistida');
    const controller = new AbortController();

    for await (const _event of first.streamReply({
      sessionId: session.id,
      content: 'status do sistema',
      signal: controller.signal,
    })) {
      // Consome o stream até o fim.
    }

    const second = new MockChatAdapter({
      tokenDelayMs: 0,
      storage: createIndexedDbChatStorage(),
    });

    const sessions = await second.listSessions();
    expect(sessions.map((item) => item.title)).toContain('Conversa persistida');

    const messages = await second.listMessages(session.id);
    expect(messages[0]).toMatchObject({ role: 'user', content: 'status do sistema' });
    expect(messages.at(-1)).toMatchObject({ role: 'assistant', status: 'done' });
    expect(messages.at(-1)?.content).toContain('Núcleo NEXA operacional');
  });

  it('persiste renomeação e exclusão de sessões', async () => {
    const storage = createIndexedDbChatStorage();
    const first = new MockChatAdapter({ tokenDelayMs: 0, storage });

    const session = await first.createSession('Título antigo');
    await first.renameSession(session.id, 'Título novo');
    await first.createSession('Descartável');

    const second = new MockChatAdapter({ tokenDelayMs: 0, storage });
    const renamed = (await second.listSessions()).find((item) => item.id === session.id);
    expect(renamed?.title).toBe('Título novo');

    await second.deleteSession(session.id);

    const third = new MockChatAdapter({ tokenDelayMs: 0, storage });
    const remaining = await third.listSessions();
    expect(remaining.some((item) => item.id === session.id)).toBe(false);
    await expect(third.listMessages(session.id)).resolves.toEqual([]);
  });
});
