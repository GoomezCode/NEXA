export interface FieldError {
  field: string;
  reason: string;
}

export interface ApiErrorInit {
  code?: string;
  requestId?: string;
  errors?: FieldError[];
  retryAfter?: number;
  resetsAt?: string;
}

/**
 * Erro único da API NEXA. Carrega o Problem Details (RFC 9457) e metadados de
 * cota usados pela UI para escolher a mensagem e a ação.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly code?: string;
  readonly requestId?: string;
  readonly errors?: FieldError[];
  readonly retryAfter?: number;
  readonly resetsAt?: string;

  constructor(status: number, title: string, detail?: string, init: ApiErrorInit = {}) {
    super(title);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.code = init.code;
    this.requestId = init.requestId;
    this.errors = init.errors;
    this.retryAfter = init.retryAfter;
    this.resetsAt = init.resetsAt;
  }
}

/** Converte application/problem+json (ou qualquer corpo de erro) em ApiError. */
export async function toApiError(response: Response): Promise<ApiError> {
  const retry = Number(response.headers.get('Retry-After'));
  const init: ApiErrorInit = {
    requestId: response.headers.get('X-Request-ID') ?? undefined,
    retryAfter: Number.isFinite(retry) && retry > 0 ? retry : undefined,
  };
  let title = `Erro ${response.status}`;
  let detail: string | undefined;

  try {
    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body.title === 'string') title = body.title;
    if (typeof body.detail === 'string') detail = body.detail;
    if (typeof body.code === 'string') init.code = body.code;
    if (typeof body.request_id === 'string') init.requestId = body.request_id;
    if (typeof body.resets_at === 'string') init.resetsAt = body.resets_at;
    if (Array.isArray(body.errors)) init.errors = body.errors as FieldError[];
  } catch {
    // corpo não-JSON (por exemplo, 502 HTML do proxy): mantém o título padrão
  }

  return new ApiError(response.status, title, detail, init);
}
