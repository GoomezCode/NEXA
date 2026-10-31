import { ApiError } from './client/problem';

interface Entry {
  title: string;
  message: string;
}

export const ERROR_CATALOG: Record<string, Entry> = {
  invalid_credentials: { title: 'Credenciais inválidas', message: 'Usuário ou senha inválidos.' },
  login_locked: { title: 'Login bloqueado', message: 'Muitas tentativas de login.' },
  username_conflict: { title: 'Usuário já existe', message: 'Esse usuário ou e-mail já está em uso.' },
  registration_disabled: {
    title: 'Cadastro desativado',
    message: 'O cadastro público está desativado neste servidor.',
  },
  validation_error: { title: 'Dados inválidos', message: 'Revise os campos informados.' },
  invalid_token: { title: 'Sessão inválida', message: 'Entre novamente para continuar.' },
  token_expired: { title: 'Sessão expirada', message: 'Sua sessão expirou. Entre novamente.' },
  forbidden: { title: 'Acesso restrito', message: 'Você não tem permissão para este recurso.' },
  not_found: { title: 'Indisponível', message: 'Esta API não oferece essa operação.' },
  method_not_allowed: { title: 'Indisponível', message: 'Esta API não oferece essa operação.' },
  rate_limited: { title: 'Muitas requisições', message: 'Muitas mensagens em pouco tempo.' },
  guest_daily_limit_reached: {
    title: 'Cota diária esgotada',
    message: 'Você usou todas as mensagens de hoje como convidado. Entre para continuar.',
  },
  user_daily_limit_reached: {
    title: 'Cota diária esgotada',
    message: 'A cota diária da sua conta foi atingida.',
  },
  ip_daily_limit_reached: {
    title: 'Cota da rede esgotada',
    message: 'A cota diária desta rede foi atingida.',
  },
  guest_token_limit_reached: {
    title: 'Muitas sessões',
    message: 'Muitas sessões de convidado neste local.',
  },
  model_not_found: {
    title: 'Modelo indisponível',
    message: 'Esse modelo não está mais disponível.',
  },
  model_not_allowed: {
    title: 'Modelo não permitido',
    message: 'Esse modelo não é permitido pelo servidor.',
  },
  unsupported_capability: {
    title: 'Recurso não suportado',
    message: 'Esse modelo não suporta o recurso solicitado.',
  },
  ai_provider_error: { title: 'Falha do provedor', message: 'O provedor de IA falhou.' },
  provider_unavailable: {
    title: 'Provedor indisponível',
    message: 'O provedor de IA está indisponível.',
  },
  ai_provider_timeout: {
    title: 'Provedor lento',
    message: 'O provedor demorou demais para responder.',
  },
  internal_error: { title: 'Erro na API', message: 'Ocorreu um erro inesperado na API.' },
  network_error: {
    title: 'Sem conexão com a API',
    message: 'Não foi possível falar com a API. Verifique a URL e o CORS.',
  },
  stream_interrupted: {
    title: 'Conexão interrompida',
    message: 'A conexão foi interrompida. O texto recebido foi mantido.',
  },
  unknown: { title: 'Erro', message: 'Ocorreu um erro inesperado. Tente novamente.' },
};

export function formatWait(seconds: number): string {
  return seconds < 60 ? `${Math.ceil(seconds)} s` : `${Math.ceil(seconds / 60)} min`;
}

export interface DescribedError extends Entry {
  code?: string;
  status?: number;
  requestId?: string;
}

export function describeError(error: unknown): DescribedError {
  if (error instanceof ApiError) {
    const fallback =
      error.status === 401
        ? 'token_expired'
        : error.status === 429
          ? 'rate_limited'
          : error.status >= 500
            ? 'internal_error'
            : 'unknown';
    const entry = ERROR_CATALOG[error.code ?? fallback] ?? ERROR_CATALOG[fallback]!;
    const wait = error.retryAfter ? ` Tente novamente em ${formatWait(error.retryAfter)}.` : '';

    return {
      title: entry.title,
      message: `${entry.message}${wait}`,
      code: error.code,
      status: error.status,
      requestId: error.requestId,
    };
  }

  return {
    ...ERROR_CATALOG.unknown!,
    message: error instanceof Error ? error.message : ERROR_CATALOG.unknown!.message,
  };
}

/** Não repete 4xx (exceto timeout), apenas falhas transitórias. */
export function shouldRetryRequest(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500 && error.status !== 408) {
    return false;
  }

  return failureCount < 1;
}
