import { useAuthStore, type AuthRole } from '@/stores/auth-store';

import { parseJson, rawFetch, request, type RequestOptions } from './client/http';
import { toApiError } from './client/problem';

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  role: AuthRole;
  user_id: string | null;
}

export interface RegisterInput {
  username: string;
  email?: string;
  password: string;
}

function apply(data: TokenResponse, username: string | null): void {
  useAuthStore.getState().setSession({
    token: data.access_token,
    role: data.role,
    userId: data.user_id,
    username,
    expiresAt: Date.now() + data.expires_in * 1000 - 30_000,
  });
}

export async function loginWithPassword(username: string, password: string): Promise<void> {
  const data = await request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  apply(data, username.trim());
}

/** Exige POST /auth/register na API (seção 7 do plano). */
export async function registerAccount(input: RegisterInput): Promise<void> {
  const data = await request<TokenResponse>('/auth/register', { method: 'POST', body: input });
  apply(data, input.username.trim());
}

let guestFlight: Promise<string> | null = null;

/** Emite (ou renova) o token de convidado. Chamadas simultâneas compartilham uma única requisição. */
export function ensureGuest(): Promise<string> {
  guestFlight ??= request<TokenResponse>('/auth/guest', { method: 'POST' })
    .then((data) => {
      apply(data, null);
      return data.access_token;
    })
    .finally(() => {
      guestFlight = null;
    });

  return guestFlight;
}

export function logout(): void {
  useAuthStore.getState().clear();
}

/** Devolve um token válido ou null. Só renova sozinho o token de convidado. */
export async function ensureToken(): Promise<string | null> {
  const { session } = useAuthStore.getState();

  if (session && session.expiresAt > Date.now()) return session.token;
  if (session?.role === 'guest') return ensureGuest();

  if (session) useAuthStore.getState().markExpired();
  return null;
}

async function handleUnauthorized(): Promise<string | null> {
  const { session } = useAuthStore.getState();

  if (session?.role === 'guest') {
    useAuthStore.getState().clear();
    return ensureGuest();
  }

  useAuthStore.getState().markExpired();
  return null;
}

/** fetch autenticado: injeta o token e, no 401, renova convidado e repete 1 vez. */
export async function authorizedFetch(path: string, opts: RequestOptions = {}): Promise<Response> {
  const token = await ensureToken();
  let response = await rawFetch(path, { ...opts, token });

  if (response.status === 401) {
    const renewed = await handleUnauthorized();
    if (renewed) response = await rawFetch(path, { ...opts, token: renewed });
  }

  if (!response.ok) throw await toApiError(response);
  return response;
}

export async function authorizedRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return parseJson<T>(await authorizedFetch(path, opts));
}
