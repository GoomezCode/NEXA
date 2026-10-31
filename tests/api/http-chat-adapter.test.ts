import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpChatAdapter } from '@/api/adapters/http';
import { createLocalChatRepository } from '@/api/adapters/local-chat';
import { ApiError } from '@/api/client/problem';
import type { ChatStreamEvent } from '@/api/types';
import { resetAuthForTests, useAuthStore } from '@/stores/auth-store';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseResponse(body: string, chunkSize = 7): Response {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(body);
  let offset = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }

      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });

  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function makeAdapter(): HttpChatAdapter {
  return new HttpChatAdapter(createLocalChatRepository());
}

function signIn() {
  useAuthStore.getState().setSession({
    token: 'segredo',
    role: 'user',
    userId: 'u1',
    username: 'ana',
    expiresAt: Date.now() + 3_600_000,
  });
}

async function collect(
  adapter: HttpChatAdapter,
  modelId: string | null = null,
): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];

  for await (const event of adapter.streamReply({
    sessionId: 'boas-vindas',
    content: 'Oi',
    signal: new AbortController().signal,
    modelId,
  })) {
    events.push(event);
  }

  return events;
}

beforeEach(() => {
  resetAuthForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HttpChatAdapter', () => {
  it('mantém sessões e mensagens no repositório local', async () => {
    const adapter = makeAdapter();

    const sessions = await adapter.listSessions();
    expect(sessions.map((session) => session.id)).toContain('boas-vindas');

    const session = await adapter.createSession('Teste');
    await expect(adapter.listMessages(session.id)).resolves.toEqual([]);
  });

  it('envia a lista completa de mensagens com Authorization', async () => {
    signIn();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse(
          'data: {"content":"Olá"}\n\nevent: done\ndata: {"finish_reason":"stop","model_id":"m"}\n\n',
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const events = await collect(makeAdapter());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/api/v1/chat')).toBe(true);
    expect(init.method).toBe('POST');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer segredo');

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.stream).toBe(true);
    expect(body.model).toBeUndefined();
    expect(body.messages).toEqual([{ role: 'user', content: 'Oi' }]);
    expect(body.personalization).toEqual({ display_name: 'ana', memories: [] });

    expect(events).toEqual([
      { type: 'meta', requestId: undefined },
      { type: 'token', value: 'Olá' },
      { type: 'done', finishReason: 'stop', modelId: 'm', providerUsage: undefined, usage: undefined },
    ]);
  });

  it('envia o modelo escolhido e persiste a resposta', async () => {
    signIn();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse('data: {"content":"ok"}\n\nevent: done\ndata: {"finish_reason":"stop"}\n\n'),
      );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = makeAdapter();
    await collect(adapter, 'nexa/mini');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ model: 'nexa/mini' });

    const messages = await adapter.listMessages('boas-vindas');
    expect(messages.at(-2)).toMatchObject({ role: 'user', content: 'Oi' });
    expect(messages.at(-1)).toMatchObject({ role: 'assistant', status: 'done', content: 'ok' });
  });

  it('converte 401 em ApiError e encerra a sessão do usuário', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ code: 'token_expired', title: 'Sessão expirada' }, 401)),
    );

    await expect(collect(makeAdapter())).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe('expired');
  });
});
