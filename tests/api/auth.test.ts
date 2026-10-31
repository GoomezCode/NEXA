import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authorizedRequest, ensureGuest, loginWithPassword } from '@/api/auth';
import { ApiError } from '@/api/client/problem';
import { resetAuthForTests, useAuthStore } from '@/stores/auth-store';

function tokenResponse(role: 'guest' | 'user' | 'admin', token: string) {
  return new Response(
    JSON.stringify({
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      role,
      user_id: role === 'guest' ? null : 'u1',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function unauthorized() {
  return new Response(JSON.stringify({ code: 'token_expired', title: 'Sessão expirada' }), {
    status: 401,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

beforeEach(() => {
  resetAuthForTests();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auth', () => {
  it('login grava o token apenas em sessionStorage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(tokenResponse('admin', 't')));

    await loginWithPassword('admin', 'segredo123');

    expect(useAuthStore.getState().session).toMatchObject({ role: 'admin', token: 't' });
    expect(window.sessionStorage.getItem('nexa:auth:session:v1')).toContain('"token":"t"');
    expect(window.localStorage.getItem('nexa:auth:guest:v1')).toBeNull();
  });

  it('chamadas simultâneas de convidado compartilham uma requisição', async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse('guest', 'g'));
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await Promise.all([ensureGuest(), ensureGuest(), ensureGuest()]);

    expect(tokens).toEqual(['g', 'g', 'g']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toMatchObject({ role: 'guest', token: 'g' });
    expect(window.localStorage.getItem('nexa:auth:guest:v1')).toContain('"token":"g"');
    expect(window.sessionStorage.getItem('nexa:auth:session:v1')).toBeNull();
  });

  it('401 de convidado renova o token e repete uma vez', async () => {
    useAuthStore.getState().setSession({
      token: 'velho',
      role: 'guest',
      userId: null,
      username: null,
      expiresAt: Date.now() + 60_000,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(tokenResponse('guest', 'novo'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ daily_limit: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(authorizedRequest('/usage')).resolves.toEqual({ daily_limit: null });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(useAuthStore.getState().session).toMatchObject({ role: 'guest', token: 'novo' });
    expect(useAuthStore.getState().status).toBe('idle');
  });

  it('401 de usuário encerra a sessão sem repetir', async () => {
    useAuthStore.getState().setSession({
      token: 't',
      role: 'user',
      userId: 'u1',
      username: 'ana',
      expiresAt: Date.now() + 60_000,
    });

    const fetchMock = vi.fn().mockResolvedValue(unauthorized());
    vi.stubGlobal('fetch', fetchMock);

    await expect(authorizedRequest('/usage')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe('expired');
    expect(window.sessionStorage.getItem('nexa:auth:session:v1')).toBeNull();
  });
});
