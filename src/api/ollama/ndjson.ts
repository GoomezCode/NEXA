export interface NdjsonOptions {
  firstChunkIdleMs?: number;
  idleMs?: number;
  signal?: AbortSignal;
}

/** Lê linhas NDJSON sem depender do alinhamento dos chunks da rede. */
export async function* readNdjson<T = Record<string, unknown>>(
  body: ReadableStream<Uint8Array>,
  { firstChunkIdleMs = 5 * 60_000, idleMs = 60_000, signal }: NdjsonOptions = {},
): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let receivedLine = false;
  let completed = false;

  const read = async () => {
    if (signal?.aborted) throw new DOMException('A operação foi cancelada.', 'AbortError');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(receivedLine
            ? 'O Ollama parou de enviar dados por 60 segundos.'
            : 'O modelo ainda está carregando. O Ollama não enviou o primeiro token em 5 minutos.')), receivedLine ? idleMs : firstChunkIdleMs);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };

  const parseLine = (line: string): T | null => {
    if (!line.trim()) return null;
    const value = JSON.parse(line) as T & { error?: unknown };
    if (typeof value.error === 'string') throw new Error(value.error);
    receivedLine = true;
    return value;
  };

  try {
    while (true) {
      const { value, done } = await read();
      if (done) {
        completed = true;
        buffer += decoder.decode();
        const last = parseLine(buffer);
        if (last !== null) yield last;
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const item = parseLine(line);
        if (item !== null) yield item;
      }
    }
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
