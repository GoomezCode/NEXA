import { afterEach, describe, expect, it, vi } from 'vitest';

import { rawFetch } from '@/api/client/http';
import { ApiError, toApiError } from '@/api/client/problem';
import { resetSettingsForTests } from '@/stores/settings-store';

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetSettingsForTests();
});

describe('toApiError', () => {
  it('lê Problem Details completo', async () => {
    const error = await toApiError(
      jsonResponse(
        {
          title: 'Dados inválidos',
          detail: 'Revise os campos.',
          code: 'validation_error',
          request_id: 'req-1',
          resets_at: '2026-10-30T12:00:00Z',
          errors: [{ field: 'password', reason: 'curta' }],
        },
        422,
        { 'Retry-After': '30' },
      ),
    );

    expect(error).toMatchObject({
      name: 'ApiError',
      status: 422,
      title: 'Dados inválidos',
      detail: 'Revise os campos.',
      code: 'validation_error',
      requestId: 'req-1',
      resetsAt: '2026-10-30T12:00:00Z',
      retryAfter: 30,
      errors: [{ field: 'password', reason: 'curta' }],
    });
  });

  it('mantém o título padrão para corpo não-JSON', async () => {
    const error = await toApiError(new Response('<html>502</html>', { status: 502 }));

    expect(error.status).toBe(502);
    expect(error.title).toBe('Erro 502');
    expect(error.retryAfter).toBeUndefined();
    expect(error.code).toBeUndefined();
  });
});

describe('rawFetch', () => {
  it('serializa o corpo, envia token e X-Request-ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await rawFetch('/chat', { method: 'POST', body: { a: 1 }, token: 't' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer t');
    expect(headers.get('X-Request-ID')).toBeTruthy();
    expect(init.body).toBe('{"a":1}');
  });

  it('converte falha de rede em network_error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(rawFetch('/health', { root: true })).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      code: 'network_error',
    });
  });

  it('repassa o abort do chamador', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('abortado', 'AbortError')));

    await expect(rawFetch('/chat', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('não lança em 4xx (o chamador decide)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

    const response = await rawFetch('/usage');
    expect(response.status).toBe(401);
    expect(response).toBeInstanceOf(Response);
  });
});

describe('ApiError', () => {
  it('preserva status e código', () => {
    const error = new ApiError(429, 'Muitas', undefined, { code: 'rate_limited', retryAfter: 5 });

    expect(error).toMatchObject({ status: 429, code: 'rate_limited', retryAfter: 5 });
  });
});
