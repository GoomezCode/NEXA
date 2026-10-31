import type { ChatStreamEvent } from './types';
import { useQuery } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connection-store';
import { readNdjson } from './ollama/ndjson';

export function ollamaBase(): string {
  const value = useConnectionStore.getState().ollamaUrl.trim().replace(/\/+$/, '');
  const sameOriginProxy = value === '/ollama';
  let url: URL;
  try { url = new URL(value, window.location.origin); } catch { throw new Error('URL do Ollama inválida.'); }
  if (url.username || url.password || (!sameOriginProxy && url.protocol !== 'http:')) {
    throw new Error('A URL do Ollama precisa usar HTTP local e não pode conter credenciais.');
  }
  if (!sameOriginProxy && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.hostname !== '::1') {
    throw new Error('O Ollama precisa estar em localhost ou loopback.');
  }
  return url.href.replace(/\/$/, '');
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await fetch(`${ollamaBase()}${path}`, init); }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Ollama indisponível. Inicie com “ollama serve” e tente novamente.');
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 403) {
      throw new Error(`O Ollama recusou a chamada pelo proxy (HTTP 403). Reinicie o Vite após a alteração e confirme que a URL está como /ollama. ${detail}`.trim());
    }
    throw new Error(detail || `Ollama respondeu com erro HTTP ${response.status}.`);
  }
  return response;
}

export async function ollamaModels(): Promise<{ models: Array<Record<string, unknown>> }> {
  return (await request('/api/tags')).json() as Promise<{ models: Array<Record<string, unknown>> }>;
}

export async function ollamaShowModel(model: string): Promise<Record<string, unknown>> {
  return (await request('/api/show', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  })).json() as Promise<Record<string, unknown>>;
}

export async function ollamaChatModels(): Promise<Array<Record<string, unknown>>> {
  const { models = [] } = await ollamaModels();
  const local = models.filter((item) => typeof item.name === 'string'
    && !/:cloud$/i.test(item.name)
    && !Object.keys(item).some((key) => key.startsWith('remote_')));
  const checks = await Promise.all(local.map(async (item) => {
    const name = String(item.name);
    try {
      const info = await ollamaShowModel(name);
      if (Array.isArray(info.capabilities)) {
        return info.capabilities.includes('completion') || info.capabilities.includes('tools') ? item : null;
      }
    } catch { /* compatibility with older Ollama versions */ }
    return /embed|bge-|e5-|gte-/i.test(`${name} ${String((item.details as Record<string, unknown> | undefined)?.family ?? '')}`) ? null : item;
  }));
  return checks.filter((item): item is Record<string, unknown> => item !== null);
}

export async function ollamaVersion(): Promise<string> {
  const body = await (await request('/api/version')).json() as { version?: string };
  return body.version ?? 'desconhecida';
}

export async function ollamaPs(): Promise<{ models: Array<Record<string, unknown>> }> {
  return (await request('/api/ps')).json() as Promise<{ models: Array<Record<string, unknown>> }>;
}

export function useOllamaHealth() {
  const offline = useConnectionStore((state) => state.mode === 'offline');
  return useQuery({ queryKey: ['ollama', 'health'], queryFn: ollamaVersion, enabled: offline, staleTime: 10_000, refetchInterval: 15_000, retry: false });
}

export function useOllamaProcesses() {
  const offline = useConnectionStore((state) => state.mode === 'offline');
  return useQuery({ queryKey: ['ollama', 'ps'], queryFn: ollamaPs, enabled: offline, staleTime: 15_000, retry: false });
}

export async function* streamOllama(input: {
  model: string;
  messages: { role: string; content: string }[];
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  let response: Response;
  try {
    response = await fetch(`${ollamaBase()}/api/chat`, {
    method: 'POST', signal: input.signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify({ model: input.model, messages: input.messages, stream: true, options: { num_ctx: useConnectionStore.getState().numCtx } }),
    });
  } catch (error) {
    if (input.signal.aborted) throw error;
    throw new Error(`Não consegui falar com o Ollama em ${ollamaBase()}. Ele está rodando (“ollama serve”)? Confira também OLLAMA_ORIGINS.`);
  }
  if (!response.ok) {
    if (response.status === 404) throw new Error(`O modelo “${input.model}” não está instalado. Rode “ollama pull ${input.model}”.`);
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Ollama respondeu com erro HTTP ${response.status}.`);
  }
  if (!response.body) throw new Error('Ollama não retornou o stream da conversa.');
  yield { type: 'meta', model: `ollama/${input.model}` };
  let completed = false;
  for await (const item of readNdjson<{
    model?: string; message?: { content?: string; thinking?: string }; done?: boolean;
    done_reason?: string; prompt_eval_count?: number; eval_count?: number;
  }>(response.body, { signal: input.signal })) {
    if (item.message?.content) yield { type: 'token', value: item.message.content };
    if (item.done) {
      completed = true;
      yield { type: 'done', finishReason: item.done_reason === 'length' ? 'length' : 'stop', modelId: `ollama/${item.model ?? input.model}`, providerUsage: { prompt_tokens: item.prompt_eval_count ?? null, completion_tokens: item.eval_count ?? null } };
      return;
      }
  }
  if (!completed && !input.signal.aborted) throw new Error('A conexão com o Ollama foi interrompida.');
}
