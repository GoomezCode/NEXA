import { describe, expect, it } from 'vitest';

import { readChatStream, StreamInterruptedError } from '@/api/chat';
import type { ChatStreamEvent } from '@/api/types';

function streamOf(text: string, chunkSize = 1): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }

      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

async function collect(text: string, chunkSize = 1): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];

  for await (const event of readChatStream(streamOf(text, chunkSize))) {
    events.push(event);
  }

  return events;
}

describe('readChatStream', () => {
  it('lê trechos sem event:, ignora heartbeat e encerra no done', async () => {
    const events = await collect(
      'data: {"content":"Olá"}\n\n: ping\n\ndata: {"content":" mundo"}\n\n' +
        'event: done\ndata: {"finish_reason":"stop","model_id":"nexa-1"}\n\n',
    );

    expect(events).toEqual([
      { type: 'token', value: 'Olá' },
      { type: 'token', value: ' mundo' },
      {
        type: 'done',
        finishReason: 'stop',
        modelId: 'nexa-1',
        providerUsage: undefined,
        usage: undefined,
      },
    ]);
  });

  it('aceita CRLF e frames partidos em qualquer byte', async () => {
    const events = await collect(
      'data: {"content":"a"}\r\n\r\ndata: {"content":"b"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n',
      3,
    );

    expect(events.filter((event) => event.type === 'token')).toEqual([
      { type: 'token', value: 'a' },
      { type: 'token', value: 'b' },
    ]);
    expect(events.at(-1)?.type).toBe('done');
  });

  it('devolve tool_calls junto com o conteúdo', async () => {
    const events = await collect(
      'data: {"content":"","tool_calls":[{"id":"1","name":"x","arguments":{}}]}\n\n' +
        'event: done\ndata: {}\n\n',
    );

    expect(events[0]).toMatchObject({ type: 'tool_calls', calls: [{ id: '1', name: 'x' }] });
  });

  it('converte event: error em evento de erro e encerra', async () => {
    const events = await collect(
      'event: error\ndata: {"code":"rate_limited","detail":"Muitas","request_id":"r1"}\n\n',
    );

    expect(events).toEqual([
      { type: 'error', code: 'rate_limited', message: 'Muitas', requestId: 'r1' },
    ]);
  });

  it('ignora eventos desconhecidos', async () => {
    const events = await collect('event: custom\ndata: {"x":1}\n\ndata: {"content":"ok"}\n\nevent: done\ndata: {}\n\n');

    expect(events).toEqual([
      { type: 'token', value: 'ok' },
      {
        type: 'done',
        finishReason: undefined,
        modelId: undefined,
        providerUsage: undefined,
        usage: undefined,
      },
    ]);
  });

  it('falha com StreamInterruptedError quando o stream termina sem done', async () => {
    await expect(collect('data: {"content":"parcial"}\n\n')).rejects.toBeInstanceOf(
      StreamInterruptedError,
    );
  });
});
