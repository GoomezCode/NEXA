import { describe, expect, it } from 'vitest';

import { MockChatAdapter } from '@/api/adapters/mock';
import type { ChatStreamEvent } from '@/api/types';

describe('MockChatAdapter', () => {
  it('transmite a resposta em tokens e conclui a mensagem', async () => {
    const adapter = new MockChatAdapter({ tokenDelayMs: 0 });
    const events: ChatStreamEvent[] = [];
    const controller = new AbortController();

    for await (const event of adapter.streamReply({
      sessionId: 'boas-vindas',
      content: 'status do sistema',
      signal: controller.signal,
    })) {
      events.push(event);
    }

    const text = events
      .filter((event) => event.type === 'token')
      .map((event) => event.value)
      .join('');

    expect(events[0]).toMatchObject({ type: 'meta', model: 'nexa-mock-1' });
    expect(events.at(-1)).toMatchObject({ type: 'done' });
    expect(text).toContain('Núcleo NEXA operacional');

    const messages = await adapter.listMessages('boas-vindas');
    expect(messages.at(-1)).toMatchObject({ role: 'assistant', status: 'done' });
    expect(messages.at(-1)?.content).toBe(text);
  });

  it('interrompe o streaming e marca a mensagem como stopped', async () => {
    const adapter = new MockChatAdapter({ tokenDelayMs: 10 });
    const controller = new AbortController();
    const stream = adapter.streamReply({
      sessionId: 'boas-vindas',
      content: 'status do sistema',
      signal: controller.signal,
    });

    await expect(async () => {
      for await (const event of stream) {
        if (event.type === 'token') {
          controller.abort();
        }
      }
    }).rejects.toMatchObject({ name: 'AbortError' });

    const messages = await adapter.listMessages('boas-vindas');
    expect(messages.at(-1)?.status).toBe('stopped');
  });

  it('cria sessões independentes com histórico vazio', async () => {
    const adapter = new MockChatAdapter({ tokenDelayMs: 0 });
    const session = await adapter.createSession('Teste de sessão');

    expect(session.title).toBe('Teste de sessão');
    await expect(adapter.listMessages(session.id)).resolves.toEqual([]);
  });

  it('não duplica a mensagem do usuário ao tentar novamente', async () => {
    const adapter = new MockChatAdapter({ tokenDelayMs: 0, failFirstStream: true });
    const controller = new AbortController();
    const input = {
      sessionId: 'boas-vindas',
      content: 'status do sistema',
      signal: controller.signal,
    };

    await expect(async () => {
      for await (const _event of adapter.streamReply(input)) {
        // A primeira tentativa falha antes de emitir tokens.
      }
    }).rejects.toThrow('Falha simulada');

    expect(
      (await adapter.listMessages('boas-vindas')).filter((message) => message.role === 'user'),
    ).toHaveLength(0);

    for await (const _event of adapter.streamReply(input)) {
      // Segunda tentativa conclui normalmente.
    }

    const messages = await adapter.listMessages('boas-vindas');
    const users = messages.filter((message) => message.role === 'user');
    expect(users).toHaveLength(1);
    expect(messages.at(-1)).toMatchObject({ role: 'assistant', status: 'done' });
  });
});
