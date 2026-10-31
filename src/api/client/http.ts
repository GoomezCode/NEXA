import { getSettingsSnapshot } from '@/stores/settings-store';

import { apiBase, apiOrigin } from '../config';
import { ApiError, toApiError } from './problem';
import { isOfflineMode } from '@/stores/connection-store';

export function generateRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  );
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Token já resolvido. Quem decide o token é `authorizedFetch` (src/api/auth.ts). */
  token?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  query?: Record<string, string | number | boolean | undefined>;
  /** true = rota na raiz (/health…), false = rota nativa (/api/v1/…). */
  root?: boolean;
  headers?: HeadersInit;
}

function buildUrl(path: string, opts: RequestOptions): string {
  const { apiUrl } = getSettingsSnapshot();
  const base = opts.root ? apiOrigin(apiUrl) : apiBase(apiUrl);
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined) {
      qs.set(key, String(value));
    }
  }

  return `${base}${path}${qs.size ? `?${qs}` : ''}`;
}

/** fetch com URL base, cabeçalhos, timeout e erro de rede padronizado. Não lança em 4xx/5xx. */
export async function rawFetch(path: string, opts: RequestOptions = {}): Promise<Response> {
  if (isOfflineMode()) {
    throw new ApiError(0, 'Modo offline ativo: chamadas à API NEXA estão bloqueadas.', undefined, { code: 'offline_mode' });
  }
  const headers = new Headers(opts.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  headers.set('X-Request-ID', generateRequestId());
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json');
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`);

  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 30_000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  try {
    return await fetch(buildUrl(path, opts), {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal,
    });
  } catch (error) {
    if (opts.signal?.aborted) throw error; // cancelamento do usuário: o chamador trata
    throw new ApiError(0, 'Erro de rede', 'Verifique a URL da API, o proxy e o CORS.', {
      code: 'network_error',
    });
  }
}

/** Requisição JSON sem autenticação automática (login, guest, health). */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const response = await rawFetch(path, opts);
  if (!response.ok) throw await toApiError(response);
  return parseJson<T>(response);
}

export async function parseJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
