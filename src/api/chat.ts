import { authorizedFetch } from './auth';
import { ApiError } from './client/problem';
import type { ChatStreamEvent, FinishReason, ProviderUsage, UsageInfo } from './types';

export class StreamInterruptedError extends Error {
  constructor() {
    super('A conexão foi interrompida.');
    this.name = 'StreamInterruptedError';
  }
}

function mapFrame(frame: string): ChatStreamEvent[] {
  let name = 'message';
  const data: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue; // heartbeat
    if (line.startsWith('event:')) name = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }

  if (data.length === 0) return [];

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data.join('\n')) as Record<string, unknown>;
  } catch {
    return [];
  }

  if (name === 'done') {
    return [
      {
        type: 'done',
        finishReason: payload.finish_reason as FinishReason | undefined,
        modelId: typeof payload.model_id === 'string' ? payload.model_id : undefined,
        keySource:
          payload.key_source === 'user' || payload.key_source === 'server'
            ? payload.key_source
            : undefined,
        providerUsage: payload.provider_usage as ProviderUsage | undefined,
        usage: payload.usage as UsageInfo | undefined,
      },
    ];
  }

  if (name === 'error') {
    return [
      {
        type: 'error',
        code: typeof payload.code === 'string' ? payload.code : 'unknown',
        message: typeof payload.detail === 'string' ? payload.detail : 'Falha ao gerar a resposta.',
        requestId: typeof payload.request_id === 'string' ? payload.request_id : undefined,
      },
    ];
  }

  if (name !== 'message') return []; // evento desconhecido: ignora

  const out: ChatStreamEvent[] = [];
  if (typeof payload.content === 'string' && payload.content) {
    out.push({ type: 'token', value: payload.content });
  }
  if (Array.isArray(payload.tool_calls) && payload.tool_calls.length) {
    out.push({ type: 'tool_calls', calls: payload.tool_calls as never });
  }
  return out;
}

async function readWithIdle(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ms: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const idle = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StreamInterruptedError()), ms);
  });

  try {
    return await Promise.race([reader.read(), idle]);
  } finally {
    clearTimeout(timer);
  }
}

export async function* readChatStream(
  body: ReadableStream<Uint8Array>,
  idleMs = 75_000,
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await readWithIdle(reader, idleMs);
      if (done) throw new StreamInterruptedError(); // acabou sem done/error

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        for (const event of mapFrame(frame)) {
          yield event;
          if (event.type === 'done' || event.type === 'error') return;
        }
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

export async function* streamChat(input: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  modelId?: string | null;
  personalization?: { display_name?: string; memories: { title: string; content: string }[] };
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const response = await authorizedFetch('/chat', {
    method: 'POST',
    body: {
      messages: input.messages,
      stream: true,
      ...(input.modelId ? { model: input.modelId } : {}),
      ...(input.personalization ? { personalization: input.personalization } : {}),
    },
    headers: { Accept: 'text/event-stream' },
    signal: input.signal,
    timeoutMs: 130_000,
  });

  if (!response.body) {
    throw new ApiError(502, 'A API não retornou corpo para o streaming.', undefined, {
      code: 'stream_interrupted',
    });
  }

  yield { type: 'meta', requestId: response.headers.get('X-Request-ID') ?? undefined };
  yield* readChatStream(response.body);
}

/** Converte finish_reason em string de exibição PT-BR. */
export function formatFinishReason(reason: string): string {
  const map: Record<string, string> = {
    stop: 'Resposta completa',
    length: 'Resposta cortada pelo limite de tamanho',
    timeout: 'Resposta cortada pelo limite de tempo',
    tool_use: 'Resposta com uso de ferramentas',
  };
  return map[reason] ?? reason;
}
