# NEXA Web UI — Correção da autenticação (Login, Cadastro e token)

> Nota (31/10/2026): a interface Clássica e a pasta `web_referencia` foram removidas. As fases e itens que tratam do Clássico estão encerrados e não representam o código atual.

> **Data:** 30/10/2026
> **Base analisada:** repositório `NEXA_WEB_UI` (árvore, `src/`, `tests/`, `e2e/`, configs) e `docs/PLANO_INTEGRACAO_NEXA_API.md`.
> **Método:** leitura estática do código. **Não executei** o projeto nem vi o código da API; o contrato da API vem do plano de integração (SRS v2.0). Onde eu suponho algo, está marcado como *suposição*.
> **Regra de ouro (mantida):** nenhuma alteração de tema. Só tokens, fontes, raios e alvos de toque (≥ 44 px) que já existem.

> **Estado atual (31/10/2026):** este documento registra a auditoria inicial e as decisões que orientaram a implementação. Login, convidado, cadastro controlado por configuração, persistência/expiração de sessão e telas de acesso estão no código atual. As seções de diagnóstico abaixo descrevem o estado observado antes dessas mudanças, não necessariamente o comportamento presente. Consulte o [README](../README.md) para executar e o [índice de documentação](README.md) para o estado dos demais planos.

---

## 1. Resumo

O erro de autenticação **não é um bug isolado**. Quatro problemas se somam:

| # | Causa raiz | Onde | Efeito |
|---|---|---|---|
| 1 | O adaptador HTTP é criado **sem token** | `src/api/index.ts` (`new HttpChatAdapter({ baseUrl })`, sem `getAccessToken`) | Nenhuma requisição leva `Authorization: Bearer` → a API responde `401` |
| 2 | O `auth-store` é **simulado** | `src/stores/auth-store.ts` | `login()` e `ensureToken()` fabricam tokens falsos (`mock-jwt-…`, `guest-…`) e **nunca chamam** `/auth/login` nem `/auth/guest` |
| 3 | O adaptador fala o **contrato antigo** | `src/api/adapters/http.ts` | Chama `/chat/sessions…`, que não existe. A API real só tem `POST /api/v1/chat` com a lista completa de mensagens |
| 4 | **Não existem telas** de Login/Cadastro | `AppView = 'chat' \| 'memory' \| 'monitor' \| 'settings'` | O usuário não tem como obter um token |

Além disso há duas armadilhas de ambiente que produzem sintomas parecidos (seção 2.1).

**Sobre o Cadastro:** segundo o plano, a API **não tem cadastro público**. Só existem `POST /auth/guest`, `POST /auth/login` (admin e usuário de teste) e `POST /admin/users` (criação por admin). Para a tela de Cadastro funcionar é preciso **adicionar `POST /api/v1/auth/register` na API** (contrato proposto na seção 7). A UI fica pronta e protegida por flag até lá.

---

## 2. Diagnóstico

### 2.1 Antes de mexer no código: confira o ambiente (15 min)

Estes itens sozinhos já explicam "não conecta":

| Sintoma | Causa provável | Correção |
|---|---|---|
| `ECONNREFUSED` / `502` no terminal do Vite | `.env.example` define `VITE_API_PROXY=http://localhost:3001`; a API sobe em `:8000` | `VITE_API_PROXY=http://localhost:8000` |
| A tela continua em "modo demo" mesmo com `.env` em `false` | `settings-store` persiste `demoMode` em `localStorage` (`nexa:settings:v1`) e isso **vence** o `.env` | Ajustes › desligar "Modo demonstração" › aplicar, ou apagar a chave no DevTools |
| Mudou o `.env` e nada mudou | O Vite só lê `.env` ao iniciar | Reiniciar `npm run dev` |
| Erro de CORS | `VITE_API_URL` absoluta (`https://…`) e API sem a origem em `CORS_ORIGINS` | Em dev, usar `/api/v1` com o proxy; em produção, ajustar `CORS_ORIGINS` |
| `404` em `/api/v1/chat/sessions` | Contrato antigo (causa 3) | Fase 4 |
| `401` em todas as chamadas | Sem `Authorization` (causas 1 e 2) | Fases 1–3 |

`.env` de desenvolvimento:

```env
VITE_API_URL=/api/v1
VITE_DEMO_MODE=false
VITE_API_PROXY=http://localhost:8000
VITE_AUTH_STORAGE=session
VITE_REGISTRATION_ENABLED=true   # ponha false até a API ter /auth/register
```

Teste a API **sem a UI**, para separar problema de API de problema de UI:

```bash
curl -i http://localhost:8000/health
curl -i -X POST http://localhost:8000/api/v1/auth/guest
curl -i -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"SUA_SENHA"}'

TOKEN='cole_o_access_token'
curl -i http://localhost:8000/api/v1/usage -H "Authorization: Bearer $TOKEN"

# sem token deve dar 401
curl -i -X POST http://localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Olá"}],"stream":false}'

# com token, em streaming
curl -N -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"messages":[{"role":"user","content":"Olá"}],"stream":true}'
```

Se o `curl` com token funciona e a UI não, o problema está na UI (o caso aqui).

### 2.2 Auditoria do repositório

**Críticos (causam o erro)**

| ID | Arquivo | Problema | Correção |
|---|---|---|---|
| C1 | `src/api/index.ts` | `HttpChatAdapter` sem `getAccessToken` | Fase 4 |
| C2 | `src/api/adapters/http.ts` | Contrato `/chat/sessions…` inexistente; `ApiError` duplicada | Fases 1 e 4 |
| C3 | `src/stores/auth-store.ts` | Login/guest/logout falsos, sem persistência e sem leitura em lugar nenhum | Fase 2 |
| C4 | `src/api/chat.ts` | URL fixa `/api/v1/chat/${sessionId}`, corpo `{content}` (a API quer `{messages}`), sem `Authorization`, ignora `settings.apiUrl`; `completeChat` lê `data.content` (a API devolve `message.content`); não é usado por ninguém | Fase 4 |
| C5 | `src/api/client/http.ts` | Stub: não serializa `body`, não põe token nem `X-Request-ID`, `signal: unknown` | Fase 1 |
| C6 | `.env.example` / `settings-store` | Proxy em `:3001`; `demoMode` persistido sobrepõe o `.env` | Seção 2.1 |

**Altos**

| ID | Arquivo | Problema |
|---|---|---|
| A1 | `src/api/health.ts` | Chama `/api/v1/health` (a rota é `/health`, na raiz). `useApiHealth` não é hook, mas tem nome de hook |
| A2 | `src/api/usage.ts` | Chama `/usage` sem prefixo e sem token; campos `guest_daily_limit…` não existem (a API usa `daily_limit`, `daily_remaining`, `per_minute_limit`, `per_minute_remaining`, `resets_at`) |
| A3 | `src/api/models.ts`, `src/stores/model-store.ts` | Sem token; tipado como `ModelInfo[]` mas a API devolve `{ default_model, providers, models }`; `loadModels` sobrescreve `selectedModelId` com o primeiro modelo e perde o "Automático"; `useModels` é chamado dentro de `loadModels` (viola rules-of-hooks) |
| A4 | `src/features/chat/use-chat.ts` | Engole o erro real (sempre "Não foi possível concluir a resposta"); `401` não tratado; `modelFromStream` e `finishReasonFromStream` nunca são preenchidos (setters `_set…` não usados); sobrou um comentário `$FlowFixMe`; não envia `modelId` |
| A5 | `src/features/monitor/MonitorDashboard.tsx` | Chama `useUsage()` (hook) dentro de função `async` num `useEffect` → "Invalid hook call"; números fixos inventados (1247 mensagens etc.); cores `bg-green-100` fora do tema; interface vazia; **não está montado** (o shell ainda usa `ModuleView`) |
| A6 | `src/features/chat/MessageBubble.tsx` | Mostra "• 42 tokens" **fixo**; o rodapé ficou fora do `div` da coluna, quebrando o layout flex |
| A7 | `src/api/errors.ts` × `src/api/client/problem.ts` | `ERROR_CATALOG` e `describeError` duplicados; códigos que a API não tem (`per_minute_limit_reached`, `context_too_large`); faltam `invalid_credentials`, `login_locked`, `username_conflict`, `validation_error` |
| A8 | `package.json` | `api:types` aponta para `/docs` (HTML do Swagger). O correto é `/openapi.json` |

**Médios**

| ID | Problema |
|---|---|
| M1 | `npm run check` provavelmente falha: imports não usados (`ChatStreamEvent as _ChatStreamEvent` em `models.ts` — o TS não isenta `_` em imports), `catch (err: any)`, `catch {}` vazios, `catch (err)` não usado em `health.ts`, hooks chamados fora de componentes |
| M2 | README e plano apontam para `docs/PLANO_DE_IMPLEMENTACAO.md` e `docs/INTEGRACAO_API.md`, que não estão na pasta `docs/`. O comentário em `indexed-db.ts` ("com a API real, o histórico vem do backend") é falso: a API não guarda histórico |
| M3 | Código órfão, sem importadores: `providers.ts`, `search.ts`, `preference-store.ts`, `thread-store.ts`, `reactions.tsx`, `message-actions.tsx`, `MessageEditor.tsx`, `ModelPicker.tsx` (retorna `null`). `providers.ts` ainda lista URLs de OpenAI/Anthropic/Gemini no frontend, o que contradiz "a API é a única fonte de IA" |
| M4 | `tests/api/http-chat-adapter.test.ts` valida o contrato antigo e vai quebrar na Fase 4 (é esperado) |
| M5 | `.env.example` tem `VITE_HEALTH_PROXY`, que o `vite.config.ts` não usa |

> Confirme os órfãos antes de apagar: `grep -rn "providers'\|preference-store\|thread-store\|reactions'\|message-actions\|MessageEditor\|ModelPicker" src tests`.

---

## 3. Decisões de arquitetura

1. **Um único cliente HTTP** (`src/api/client/http.ts`) e **uma única `ApiError`** (`src/api/client/problem.ts`). Nenhum `fetch` solto em componentes.
2. **Serviço de auth separado do store.** O `auth-store` guarda estado e persistência; `src/api/auth.ts` fala com a API. Isso evita import circular (store → http → store).
3. **Convidado explícito.** A UI não emite token de convidado escondido: o usuário escolhe *Entrar*, *Criar conta* ou *Continuar como convidado*. (Convidado que expira é renovado em silêncio.)
4. **Armazenamento do token** (como no plano, seção D4):
   - convidado → `localStorage` (`nexa:auth:guest:v1`): anônimo e de baixo privilégio; reemitir a cada reload gastaria o limite por IP;
   - admin/usuário → `sessionStorage` (`nexa:auth:session:v1`), ou só memória com `VITE_AUTH_STORAGE=memory`.
   - A API devolve o token no corpo e não usa cookies, então cookie `httpOnly` não é opção sem mudar a API.
5. **Telas como "view", não como rota.** O app não tem roteador; a tela de auth é um `AuthGate` que envolve o HUD (mesmo padrão de `SettingsView`).
6. **Troca de identidade limpa o cache.** Login/logout reiniciam o adaptador de chat e o TanStack Query, para o histórico de um usuário não aparecer para outro.
7. **Modo demo intacto.** Com `demoMode = true` o `AuthGate` é transparente e todos os testes atuais continuam valendo.

---

## 4. Fases de implementação

Ordem recomendada: **0 → 1 → 2 → 3** (já dá para logar e ver `/usage` funcionando) **→ 4 → 5 → 6 → 7**. A Fase 8 (API) corre em paralelo.

### Fase 0 — Ambiente

- Atualizar `.env.example` com o bloco da seção 2.1 (proxy `:8000`, `VITE_AUTH_STORAGE`, `VITE_REGISTRATION_ENABLED`; remover `VITE_HEALTH_PROXY`).
- `src/vite-env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_MOCK_TOKEN_DELAY?: string;
  readonly VITE_AUTH_STORAGE?: 'session' | 'memory';
  readonly VITE_REGISTRATION_ENABLED?: string;
}
```

- `package.json`:

```json
"api:types": "openapi-typescript http://localhost:8000/openapi.json -o src/api/generated/openapi.d.ts",
"api:types:check": "openapi-typescript http://localhost:8000/openapi.json -o src/api/generated/openapi.d.ts --check"
```

**Aceite:** `curl localhost:5173/health` e `curl -i localhost:5173/api/v1/usage` (esperado `401`) respondem pelo proxy.

---

### Fase 1 — Cliente HTTP e erros

**`src/api/client/problem.ts`** (substitui o arquivo atual)

```ts
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
```

**`src/api/client/http.ts`** (substitui o stub)

```ts
import { getSettingsSnapshot } from '@/stores/settings-store';

import { apiBase, apiOrigin } from '../config';
import { ApiError, toApiError } from './problem';

export function generateRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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
    if (value !== undefined) qs.set(key, String(value));
  }

  return `${base}${path}${qs.size ? `?${qs}` : ''}`;
}

/** fetch com URL base, cabeçalhos, timeout e erro de rede padronizado. Não lança em 4xx/5xx. */
export async function rawFetch(path: string, opts: RequestOptions = {}): Promise<Response> {
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
```

**Catálogo único — `src/api/errors.ts`** (apagar o catálogo e o `describeError` de `problem.ts`)

```ts
import { ApiError } from './client/problem';

interface Entry {
  title: string;
  message: string;
}

export const ERROR_CATALOG: Record<string, Entry> = {
  invalid_credentials: { title: 'Credenciais inválidas', message: 'Usuário ou senha inválidos.' },
  login_locked: { title: 'Login bloqueado', message: 'Muitas tentativas de login.' },
  username_conflict: { title: 'Usuário já existe', message: 'Esse usuário ou e-mail já está em uso.' },
  registration_disabled: { title: 'Cadastro desativado', message: 'O cadastro público está desativado neste servidor.' },
  validation_error: { title: 'Dados inválidos', message: 'Revise os campos informados.' },
  invalid_token: { title: 'Sessão inválida', message: 'Entre novamente para continuar.' },
  token_expired: { title: 'Sessão expirada', message: 'Sua sessão expirou. Entre novamente.' },
  forbidden: { title: 'Acesso restrito', message: 'Você não tem permissão para este recurso.' },
  not_found: { title: 'Indisponível', message: 'Esta API não oferece essa operação.' },
  method_not_allowed: { title: 'Indisponível', message: 'Esta API não oferece essa operação.' },
  rate_limited: { title: 'Muitas requisições', message: 'Muitas mensagens em pouco tempo.' },
  guest_daily_limit_reached: { title: 'Cota diária esgotada', message: 'Você usou todas as mensagens de hoje como convidado. Entre para continuar.' },
  user_daily_limit_reached: { title: 'Cota diária esgotada', message: 'A cota diária da sua conta foi atingida.' },
  ip_daily_limit_reached: { title: 'Cota da rede esgotada', message: 'A cota diária desta rede foi atingida.' },
  guest_token_limit_reached: { title: 'Muitas sessões', message: 'Muitas sessões de convidado neste local.' },
  model_not_found: { title: 'Modelo indisponível', message: 'Esse modelo não está mais disponível.' },
  model_not_allowed: { title: 'Modelo não permitido', message: 'Esse modelo não é permitido pelo servidor.' },
  unsupported_capability: { title: 'Recurso não suportado', message: 'Esse modelo não suporta o recurso solicitado.' },
  ai_provider_error: { title: 'Falha do provedor', message: 'O provedor de IA falhou.' },
  provider_unavailable: { title: 'Provedor indisponível', message: 'O provedor de IA está indisponível.' },
  ai_provider_timeout: { title: 'Provedor lento', message: 'O provedor demorou demais para responder.' },
  internal_error: { title: 'Erro na API', message: 'Ocorreu um erro inesperado na API.' },
  network_error: { title: 'Sem conexão com a API', message: 'Não foi possível falar com a API. Verifique a URL e o CORS.' },
  stream_interrupted: { title: 'Conexão interrompida', message: 'A conexão foi interrompida. O texto recebido foi mantido.' },
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
      error.status === 401 ? 'token_expired' : error.status === 429 ? 'rate_limited' : error.status >= 500 ? 'internal_error' : 'unknown';
    const entry = ERROR_CATALOG[error.code ?? fallback] ?? ERROR_CATALOG[fallback]!;
    const wait = error.retryAfter ? ` Tente novamente em ${formatWait(error.retryAfter)}.` : '';

    return { title: entry.title, message: `${entry.message}${wait}`, code: error.code, status: error.status, requestId: error.requestId };
  }

  return { ...ERROR_CATALOG.unknown!, message: error instanceof Error ? error.message : ERROR_CATALOG.unknown!.message };
}
```

Em `src/api/adapters/http.ts` troque a classe local por `export { ApiError } from '../client/problem';` (mantém o teste atual compilando até a Fase 4). Apague `src/api/client/rate-limit.ts` se continuar sem uso.

**Aceite:** testes de `toApiError` (Problem Details completo, corpo HTML 502, `Retry-After`, `204`, `AbortError` repassado, `network_error`).

---

### Fase 2 — Store e serviço de autenticação

**`src/stores/auth-store.ts`** (reescrever; só estado e persistência, sem chamar API)

```ts
import { create } from 'zustand';

export type AuthRole = 'guest' | 'user' | 'admin';

export interface AuthSession {
  token: string;
  role: AuthRole;
  userId: string | null;
  username: string | null;
  /** epoch ms, já descontando 30 s de folga */
  expiresAt: number;
}

const GUEST_KEY = 'nexa:auth:guest:v1';
const SESSION_KEY = 'nexa:auth:session:v1';
const memoryOnly = import.meta.env.VITE_AUTH_STORAGE === 'memory';

function read(storage: Storage, key: string): AuthSession | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AuthSession>;
    const roleOk = value.role === 'guest' || value.role === 'user' || value.role === 'admin';

    if (roleOk && typeof value.token === 'string' && typeof value.expiresAt === 'number' && value.expiresAt > Date.now()) {
      return {
        token: value.token,
        role: value.role as AuthRole,
        userId: value.userId ?? null,
        username: value.username ?? null,
        expiresAt: value.expiresAt,
      };
    }
  } catch {
    // armazenamento indisponível ou JSON inválido
  }

  return null;
}

function loadInitial(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  return read(window.sessionStorage, SESSION_KEY) ?? read(window.localStorage, GUEST_KEY);
}

function persist(session: AuthSession | null): void {
  try {
    window.localStorage.removeItem(GUEST_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);

    if (!session || (memoryOnly && session.role !== 'guest')) return;

    if (session.role === 'guest') window.localStorage.setItem(GUEST_KEY, JSON.stringify(session));
    else window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sem armazenamento: a sessão vale só em memória
  }
}

interface AuthStore {
  session: AuthSession | null;
  /** 'expired' quando um usuário/admin perdeu a sessão (mostra aviso na tela de login). */
  status: 'idle' | 'expired';
  setSession: (session: AuthSession) => void;
  clear: () => void;
  markExpired: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: loadInitial(),
  status: 'idle',
  setSession: (session) => {
    persist(session);
    set({ session, status: 'idle' });
  },
  clear: () => {
    persist(null);
    set({ session: null, status: 'idle' });
  },
  markExpired: () => {
    persist(null);
    set({ session: null, status: 'expired' });
  },
}));

export function resetAuthForTests(): void {
  persist(null);
  useAuthStore.setState({ session: null, status: 'idle' });
}
```

**`src/api/auth.ts`** (novo)

```ts
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
  const data = await request<TokenResponse>('/auth/login', { method: 'POST', body: { username, password } });
  apply(data, username.trim());
}

/** Exige POST /auth/register na API (seção 7). */
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
```

**Aceite (unitário):** login grava o token em `sessionStorage` e nada em `localStorage`; 3 chamadas simultâneas a `ensureGuest()` geram **1** `POST /auth/guest`; `401` de guest renova e repete; `401` de usuário vira `status: 'expired'` e limpa o token.

---

### Fase 3 — Telas de Login e Cadastro

**`src/features/auth/schemas.ts`**

```ts
import { z } from 'zod';

const username = z
  .string()
  .trim()
  .min(3, 'Mínimo de 3 caracteres.')
  .max(64, 'Máximo de 64 caracteres.')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Use letras, números, ponto, hífen ou sublinhado.');

const password = z.string().min(8, 'Mínimo de 8 caracteres.').max(128, 'Máximo de 128 caracteres.');

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Informe o usuário.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export const registerSchema = z
  .object({
    username,
    email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.')]),
    password,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    message: 'As senhas não conferem.',
  });

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !out[key]) out[key] = issue.message;
  }

  return out;
}
```

**`src/features/auth/AuthView.tsx`** (tokens e classes já usados em `SettingsView`/`MemoryView`)

```tsx
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from 'react';

import { ensureGuest, loginWithPassword, registerAccount } from '@/api/auth';
import { ApiError } from '@/api/client/problem';
import { describeError } from '@/api/errors';
import { NexaMark } from '@/components/brand/NexaMark';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';

import { fieldErrors, loginSchema, registerSchema } from './schemas';

type Mode = 'login' | 'register';

const REGISTRATION_ENABLED = import.meta.env.VITE_REGISTRATION_ENABLED === 'true';

function Field({
  id,
  label,
  error,
  trailing,
  ...input
}: { id: string; label: string; error?: string; trailing?: React.ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] text-muted">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'w-full rounded-xl border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/40',
            trailing && 'pr-12',
            error ? 'border-danger/40' : 'border-white/10',
          )}
          {...input}
        />
        {trailing && <div className="absolute right-0 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthView() {
  const expired = useAuthStore((state) => state.status === 'expired');
  const [mode, setMode] = useState<Mode>('login');
  const [values, setValues] = useState({ username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const change = (key: keyof typeof values) => (event: ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
  };

  const run = async (action: () => Promise<unknown>) => {
    setFormError(null);
    setBusy(true);

    try {
      await action();
    } catch (error) {
      if (error instanceof ApiError && error.errors?.length) {
        setErrors(
          Object.fromEntries(error.errors.map((item) => [item.field.split('.').pop() ?? item.field, item.reason])),
        );
      }

      setFormError(describeError(error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (mode === 'login') {
      const parsed = loginSchema.safeParse(values);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        return;
      }

      setErrors({});
      void run(() => loginWithPassword(parsed.data.username, parsed.data.password));
      return;
    }

    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    void run(() =>
      registerAccount({
        username: parsed.data.username,
        email: parsed.data.email || undefined,
        password: parsed.data.password,
      }),
    );
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((current) => !current)}
      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
      className="flex h-11 w-11 items-center justify-center text-muted transition hover:text-primary"
    >
      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </button>
  );

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-y-auto bg-background p-4 text-foreground">
      <div className="nexa-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur-xl sm:p-6">
        <div className="flex flex-col items-center text-center">
          <NexaMark size={48} />
          <h1 className="mt-3 font-display text-lg tracking-[0.3em] text-foreground">NEXA</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">acesso à interface neural</p>
        </div>

        {expired && (
          <p role="status" className="mt-4 rounded-xl border border-warning/25 bg-warning/5 p-2.5 text-[12px] text-warning">
            Sua sessão expirou. Entre novamente para continuar.
          </p>
        )}

        <div role="tablist" aria-label="Acesso" className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {(['login', 'register'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`auth-tab-${tab}`}
              aria-selected={mode === tab}
              aria-controls="auth-panel"
              onClick={() => switchMode(tab)}
              className={cn(
                'min-h-11 rounded-lg font-mono text-[10px] uppercase tracking-[0.12em] transition',
                mode === tab ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground',
              )}
            >
              {tab === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`} onSubmit={submit} noValidate className="mt-4 space-y-3">
          {mode === 'register' && !REGISTRATION_ENABLED ? (
            <p className="rounded-xl border border-white/10 bg-background/40 p-3 text-[12px] leading-relaxed text-muted">
              O cadastro público ainda não está disponível nesta API. Peça uma conta ao administrador ou continue como convidado.
            </p>
          ) : (
            <>
              <Field
                id="auth-username"
                label="Usuário"
                value={values.username}
                onChange={change('username')}
                error={errors.username}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={64}
              />

              {mode === 'register' && (
                <Field
                  id="auth-email"
                  label="E-mail (opcional)"
                  type="email"
                  value={values.email}
                  onChange={change('email')}
                  error={errors.email}
                  autoComplete="email"
                />
              )}

              <Field
                id="auth-password"
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                value={values.password}
                onChange={change('password')}
                error={errors.password}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={128}
                trailing={passwordToggle}
              />

              {mode === 'register' && (
                <Field
                  id="auth-confirm"
                  label="Confirmar senha"
                  type={showPassword ? 'text' : 'password'}
                  value={values.confirm}
                  onChange={change('confirm')}
                  error={errors.confirm}
                  autoComplete="new-password"
                  maxLength={128}
                />
              )}

              {formError && (
                <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 p-2.5 text-[12px] text-danger">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mode === 'login' ? <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> : <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
                {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </>
          )}
        </form>

        <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => ensureGuest())}
            className="min-h-11 w-full rounded-xl border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
          >
            Continuar como convidado
          </button>
          <button
            type="button"
            onClick={() => {
              useSettingsStore.getState().update({ demoMode: true });
              window.location.reload();
            }}
            className="min-h-11 w-full font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70 transition hover:text-foreground"
          >
            Usar modo demonstração
          </button>
        </div>
      </div>
    </main>
  );
}
```

**`src/features/auth/AuthGate.tsx`**

```tsx
import { useEffect, type ReactNode } from 'react';

import { ensureGuest } from '@/api/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';

import { AuthView } from './AuthView';

const MAX_TIMEOUT = 2 ** 31 - 1;

export function AuthGate({ children }: { children: ReactNode }) {
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const session = useAuthStore((state) => state.session);

  // Quando o token vence: convidado renova em silêncio; usuário/admin volta ao login.
  useEffect(() => {
    if (!session) return;

    const wait = Math.min(Math.max(0, session.expiresAt - Date.now()), MAX_TIMEOUT);
    const timer = window.setTimeout(() => {
      if (session.role === 'guest') void ensureGuest().catch(() => undefined);
      else useAuthStore.getState().markExpired();
    }, wait);

    return () => window.clearTimeout(timer);
  }, [session]);

  if (demoMode || session) return <>{children}</>;
  return <AuthView />;
}
```

**`src/app/App.tsx`** — envolver só o HUD (o modo clássico continua sem gate):

```tsx
<ErrorBoundary>
  <AuthGate>
    <AppShell />
  </AuthGate>
</ErrorBoundary>
```

**`TopBar.tsx`** — identidade e saída (visível só fora do demo):

```tsx
const session = useAuthStore((state) => state.session);
// ...dentro de <div className="ml-2 hidden items-center gap-2 md:flex"> ...
{!demoMode && session && (
  <>
    <StatusChip tone="success" label={session.role === 'guest' ? 'convidado' : (session.username ?? session.role)} />
    <button
      type="button"
      onClick={logout}
      className="min-h-11 rounded-xl border border-white/10 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted transition hover:border-primary/30 hover:text-primary"
    >
      {session.role === 'guest' ? 'Entrar' : 'Sair'}
    </button>
  </>
)}
```

No mobile esses controles ficam escondidos (`md:flex`); repita o mesmo bloco como cartão **CONTA** em `SettingsView` (usando o `SectionCard` existente): papel, usuário, validade (`session.expiresAt`) e o botão Sair/Entrar.

**Aceite:** com `demoMode=false` e sem token aparece o `AuthView`; login válido entra no HUD; credencial errada mostra "Usuário ou senha inválidos." sem revelar se o usuário existe; "Continuar como convidado" entra; recarregar a página mantém a sessão; Sair volta ao `AuthView`.

---

### Fase 4 — Chat autenticado (o que faltava para a API responder)

> O detalhamento completo (repositório local, `fitContext`, `finish_reason`, `tool_calls`) está em **F7.3 do plano**. Aqui estão as peças que dependem da autenticação.

**4.1 Tipos (`src/api/types.ts`)**

```ts
export type FinishReason = 'stop' | 'length' | 'timeout' | 'tool_use';

export interface UsageInfo {
  daily_limit: number | null;
  daily_remaining: number | null;
  per_minute_limit: number;
  per_minute_remaining: number;
  resets_at: string | null;
}
export interface ProviderUsage { prompt_tokens: number | null; completion_tokens: number | null }
export interface ToolCall { id: string; name: string; arguments: Record<string, unknown> }

export type ChatStreamEvent =
  | { type: 'meta'; requestId?: string; model?: string }
  | { type: 'token'; value: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'done'; finishReason?: FinishReason; modelId?: string; providerUsage?: ProviderUsage; usage?: UsageInfo }
  | { type: 'error'; code: string; message: string; requestId?: string };

export interface ChatStreamInput {
  sessionId: string;
  content: string;
  signal: AbortSignal;
  modelId?: string | null; // null/undefined = "Automático" (campo omitido no corpo)
}
```

No `mock.ts`: troque `{ type: 'meta', sessionId, model }` por `{ type: 'meta', model: 'nexa-mock-1' }` e `usage: { input, output }` por `providerUsage`. Os testes atuais do mock continuam passando.

**4.2 Parser SSE e `streamChat` (`src/api/chat.ts`, reescrever)**

Formato real da API: trechos `data: {"content":"…"}` **sem** `event:`; fim em `event: done`; falha em `event: error` (`code`, `detail`, `request_id`); `: ping` é heartbeat. Não existe `[DONE]`.

```ts
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
    return [{
      type: 'done',
      finishReason: payload.finish_reason as FinishReason | undefined,
      modelId: typeof payload.model_id === 'string' ? payload.model_id : undefined,
      providerUsage: payload.provider_usage as ProviderUsage | undefined,
      usage: payload.usage as UsageInfo | undefined,
    }];
  }

  if (name === 'error') {
    return [{
      type: 'error',
      code: typeof payload.code === 'string' ? payload.code : 'unknown',
      message: typeof payload.detail === 'string' ? payload.detail : 'Falha ao gerar a resposta.',
      requestId: typeof payload.request_id === 'string' ? payload.request_id : undefined,
    }];
  }

  if (name !== 'message') return []; // evento desconhecido: ignora

  const out: ChatStreamEvent[] = [];
  if (typeof payload.content === 'string' && payload.content) out.push({ type: 'token', value: payload.content });
  if (Array.isArray(payload.tool_calls) && payload.tool_calls.length) {
    out.push({ type: 'tool_calls', calls: payload.tool_calls as never });
  }
  return out;
}

async function readWithIdle(reader: ReadableStreamDefaultReader<Uint8Array>, ms: number) {
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

export async function* readChatStream(body: ReadableStream<Uint8Array>, idleMs = 75_000): AsyncGenerator<ChatStreamEvent> {
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
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const response = await authorizedFetch('/chat', {
    method: 'POST',
    body: { messages: input.messages, stream: true, ...(input.modelId ? { model: input.modelId } : {}) },
    headers: { Accept: 'text/event-stream' },
    signal: input.signal,
    timeoutMs: 130_000,
  });

  if (!response.body) {
    throw new ApiError(502, 'A API não retornou corpo para o streaming.', undefined, { code: 'stream_interrupted' });
  }

  yield { type: 'meta', requestId: response.headers.get('X-Request-ID') ?? undefined };
  yield* readChatStream(response.body);
}
```

**4.3 `HttpChatAdapter` reescrito** (substitui `/chat/sessions…`)

A API **não guarda sessões nem histórico**; o histórico fica no navegador. Extraia de `MockChatAdapter` (`ensureReady`, `hydrate`, `persistNow` e o CRUD de sessões) um `LocalChatRepository`, parametrizado por *namespace* de identidade, e faça o mock delegar a ele sem mudar comportamento:

```ts
export interface LocalChatRepository {
  listSessions(): Promise<Session[]>;
  createSession(title?: string): Promise<Session>;
  renameSession(id: string, title: string): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  listMessages(id: string): Promise<ChatMessage[]>;
  /** Grava a mensagem do usuário + um placeholder 'streaming' (e remove a troca com erro em retry). */
  beginExchange(sessionId: string, userContent: string): Promise<{ assistantId: string }>;
  finishAssistant(
    sessionId: string,
    assistantId: string,
    patch: { content: string; status: MessageStatus },
  ): Promise<void>;
}
```

Chave do IndexedDB por identidade: `nexa:chat:v2:guest` e `nexa:chat:v2:user:<user_id>` (generalize `createIndexedDbChatStorage(key = 'nexa:chat:v1')`; o modo demo segue em `v1`).

```ts
export class HttpChatAdapter implements ChatAdapter {
  constructor(private readonly repo: LocalChatRepository) {}

  listSessions() { return this.repo.listSessions(); }
  createSession(title?: string) { return this.repo.createSession(title); }
  renameSession(id: string, title: string) { return this.repo.renameSession(id, title); }
  deleteSession(id: string) { return this.repo.deleteSession(id); }
  listMessages(id: string) { return this.repo.listMessages(id); }

  async *streamReply({ sessionId, content, signal, modelId }: ChatStreamInput): AsyncIterable<ChatStreamEvent> {
    const { assistantId } = await this.repo.beginExchange(sessionId, content);
    const role = useAuthStore.getState().session?.role ?? 'guest';
    const messages = fitContext(await this.repo.listMessages(sessionId), limitsFor(role));
    let text = '';

    try {
      for await (const event of streamChat({ messages, modelId, signal })) {
        if (event.type === 'token') text += event.value;
        yield event;
        if (event.type === 'error') {
          throw new ApiError(0, event.message, undefined, { code: event.code, requestId: event.requestId });
        }
      }
      await this.repo.finishAssistant(sessionId, assistantId, { content: text, status: 'done' });
    } catch (error) {
      await this.repo.finishAssistant(sessionId, assistantId, {
        content: text,
        status: signal.aborted ? 'stopped' : 'error',
      });
      throw error;
    }
  }
}
```

**4.4 `fitContext` (obrigatório, senão a 2ª–3ª pergunta de guest dá `422`)**

Guest e usuário: **20 mensagens × 2000 caracteres**; admin: **100 × 8000**. Respostas do assistente passam de 2000 caracteres com facilidade.

```ts
// src/features/chat/context.ts
import type { ChatMessage } from '@/api/types';

export interface ContextLimits { maxMessages: number; maxChars: number }
export const limitsFor = (role: string): ContextLimits =>
  role === 'admin' ? { maxMessages: 100, maxChars: 8000 } : { maxMessages: 20, maxChars: 2000 };

export class ContextTooLargeError extends Error {
  constructor(public readonly maxChars: number) {
    super(`A mensagem passa de ${maxChars} caracteres.`);
  }
}

export function fitContext(history: ChatMessage[], { maxMessages, maxChars }: ContextLimits) {
  const merged: { role: 'user' | 'assistant'; content: string }[] = [];

  for (const message of history) {
    const text = message.content.trim();
    const valid =
      (message.role === 'user' || message.role === 'assistant') &&
      message.status !== 'error' &&
      message.status !== 'streaming' &&
      text;
    if (!valid) continue;

    const last = merged.at(-1);
    if (last?.role === message.role) last.content += `\n\n${text}`;
    else merged.push({ role: message.role as 'user' | 'assistant', content: text });
  }

  const last = merged.at(-1);
  if (!last || last.role !== 'user') throw new Error('A última mensagem precisa ser do usuário.');
  if (last.content.length > maxChars) throw new ContextTooLargeError(maxChars);

  let result = merged
    .map((m, i) => (i === merged.length - 1 || m.content.length <= maxChars ? m : { ...m, content: `${m.content.slice(0, maxChars - 1)}…` }))
    .slice(-maxMessages);

  while (result.length > 1 && result[0]!.role === 'assistant') result = result.slice(1);
  return result;
}
```

O Composer deve bloquear o envio acima de `maxChars` e mostrar o contador (plano F7.3, item 9).

**4.5 `src/api/index.ts`** — namespace por identidade e reset ao trocar de usuário

```ts
function namespace(): string {
  const session = useAuthStore.getState().session;
  return !session || session.role === 'guest' ? 'guest' : `user:${session.userId}`;
}

// em getChatAdapter(), ramo real:
new HttpChatAdapter(
  createLocalChatRepository({
    storage: createIndexedDbChatStorage(`nexa:chat:v2:${namespace()}`),
  }),
);

// fora da função: ao mudar de identidade, descarta adaptador e cache
let identity = namespace();
useAuthStore.subscribe(() => {
  const next = namespace();
  if (next === identity) return;
  identity = next;
  adapter = undefined;
  queryClient.clear();
  useUiStore.getState().setActiveSessionId(null);
});
```

**4.6 `use-chat.ts`** — mostrar o erro real e não esconder `401`/`429`

```ts
// no for-await: passar o modelo escolhido
streamReply({ sessionId, content: trimmed, signal: controller.signal, modelId: useModelStore.getState().selectedModelId })

// no catch (que não é AbortError):
const info = describeError(caught);
setErrorState({ sessionId, message: info.message });
setAiState('error');
notify({ tone: 'error', title: info.title, message: info.message });
```

Remova o comentário `$FlowFixMe` e preencha `modelFromStream`/`finishReasonFromStream` com `event.type === 'done'` (ou apague esses campos até a F7.3). Um `401` de usuário/admin já derruba a sessão (`markExpired`) e o `AuthGate` mostra o login.

**4.7 `MessageBubble.tsx`** — remover o "• 42 tokens" fixo e mover o rodapé para dentro da coluna da mensagem; mostrar tokens só se `message.meta?.completionTokens` existir.

**Aceite:** login → mensagem → resposta em streaming; com token apagado do `sessionStorage` a próxima ação cai no login; 6 trocas seguidas como convidado não geram `422`; "Parar" encerra a conexão.

---

### Fase 5 — Leituras autenticadas (usage, modelos, saúde)

```ts
// src/api/usage.ts
export function useUsage() {
  const demoMode = useSettingsStore((s) => s.settings.demoMode);
  const role = useAuthStore((s) => s.session?.role ?? null);

  return useQuery({
    queryKey: ['usage', role],
    queryFn: () => authorizedRequest<UsageInfo>('/usage'),
    enabled: !demoMode && role !== null,
    staleTime: 15_000,
  });
}

// src/api/models.ts
export function useModels() {
  const role = useAuthStore((s) => s.session?.role ?? null);
  return useQuery({
    queryKey: ['models', role],
    queryFn: () => authorizedRequest<ModelsResponse>('/models'),
    enabled: role !== null,
    staleTime: 60_000,
  });
}

// src/api/health.ts  (rota pública na raiz)
export function useApiHealth() {
  const demoMode = useSettingsStore((s) => s.settings.demoMode);
  return useQuery({
    queryKey: ['health'],
    queryFn: () => request<{ status: string; version?: string }>('/health', { root: true }),
    enabled: !demoMode,
    refetchInterval: 30_000,
    retry: false,
  });
}
```

- `model-store` fica só com `selectedModelId: string | null` (`null` = "Automático") persistido em `nexa:model:v1`. Apague `loadModels`, `provider` e o import de `providers.ts`.
- `ModelsResponse` vem do Apêndice B do plano (`{ default_model, providers[], models[] }`).
- `useQuery` com `retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 1` evita repetir 401/403/404/422.

---

### Fase 6 — Limpeza

1. Apagar o que a seção 2.2 (M3) listou como órfão, após o `grep`.
2. Apagar `MonitorDashboard.tsx` agora e reimplementar o Monitor conforme **F7.7**; o atual não funciona e inventa números.
3. Corrigir comentários e docs: `indexed-db.ts` (histórico é local), README (`docs/…` com os nomes reais, `GET /models?refresh=true`, "A API não guarda histórico").
4. Rodar `npm run lint && npm run typecheck && npm test && npm run build` até ficar verde.

---

## 5. Testes

**Unitários (Vitest)**

| Arquivo | Casos |
|---|---|
| `tests/api/client.test.ts` | `toApiError` (Problem Details, HTML 502, `Retry-After`), `network_error`, `204`, `Content-Type` só com corpo, `X-Request-ID` enviado |
| `tests/api/auth.test.ts` | login grava em `sessionStorage`; guest em `localStorage`; *single-flight* do guest; `401` de guest renova e repete; `401` de usuário → `status: 'expired'`; `VITE_AUTH_STORAGE=memory` |
| `tests/api/sse.test.ts` | quadros partidos em qualquer byte, CRLF, `: ping`, `content` + `tool_calls`, `done`, `error`, fim sem `done` → `StreamInterruptedError`, evento desconhecido ignorado |
| `tests/features/fit-context.test.ts` | descarta antigas, trunca antigas, colapsa papéis repetidos, ignora `error`/`streaming`, última mensagem intacta |
| `tests/api/http-chat-adapter.test.ts` | **reescrever** para o contrato real: corpo `{ messages, stream, model? }`, `Authorization` presente, `model` omitido em "Automático" |

Exemplo (`auth.test.ts`):

```ts
it('login grava o token só em sessionStorage', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ access_token: 't', token_type: 'bearer', expires_in: 3600, role: 'admin', user_id: 'u1' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ));

  await loginWithPassword('admin', 'segredo123');

  expect(useAuthStore.getState().session).toMatchObject({ role: 'admin', token: 't' });
  expect(sessionStorage.getItem('nexa:auth:session:v1')).toContain('"token":"t"');
  expect(localStorage.getItem('nexa:auth:guest:v1')).toBeNull();
});
```

**Componente:** `AuthView` — validação (usuário curto, senha < 8, confirmação), `401` mostra a mensagem genérica, `409` em cadastro, `login_locked` com tempo de espera, aba Cadastro desativada com a flag em `false`.

**E2E (Playwright, com `page.route`; os specs atuais seguem em demo)**

```ts
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('nexa:settings:v1', JSON.stringify({ demoMode: false, apiUrl: '/api/v1' }));
  });
});

test('login libera o HUD', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({ json: { access_token: 't', token_type: 'bearer', expires_in: 3600, role: 'user', user_id: 'u1' } }),
  );
  await page.route('**/api/v1/usage', (route) =>
    route.fulfill({ json: { daily_limit: 100, daily_remaining: 100, per_minute_limit: 10, per_minute_remaining: 10, resets_at: null } }),
  );

  await page.goto('/');
  await page.getByLabel('Usuário').fill('teste01');
  await page.getByLabel('Senha', { exact: true }).fill('segredo123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();

  await expect(page.getByRole('textbox', { name: 'Mensagem para a NEXA' })).toBeVisible();
});
```

Adicione ainda: credencial inválida; token removido → volta ao login; axe sem violações em `AuthView` (desktop e 390 px); alvos ≥ 44 px (`e2e/targets.spec.ts`).

---

## 6. Segurança

- Nenhuma chave de provedor no frontend; `providers.ts` sai.
- Token nunca em URL, log ou `console`. Senha só no estado do formulário (não vai para Query cache nem storage).
- `autocomplete` correto (`username`, `current-password`, `new-password`) para gerenciadores de senha.
- Erro de login genérico ("Usuário ou senha inválidos."). No cadastro, `username_conflict` revela que o usuário existe; é a troca habitual, mitigada por limite de taxa no servidor.
- Markdown continua sanitizado (`rehype-sanitize`); campos como `username` são renderizados como texto.
- Produção só por HTTPS, `CORS_ORIGINS` restrito à origem da UI e CSP com `connect-src` da API.

---

## 7. API: o que precisa existir para o Cadastro (Fase 8)

> *Suposição:* não vi o código da API. Pelo plano (SRS v2.0), hoje só existem `/auth/guest`, `/auth/login` e a criação de usuários por admin. Ajuste os nomes ao que a API já usa.

**Obrigatório para a UI funcionar**

| # | Item | Motivo |
|---|---|---|
| A1 | Incluir `PATCH` e `DELETE` em `ALLOWED_METHODS` (`app/main.py`, hoje `GET, POST, OPTIONS`) | Sem isso, editar/excluir usuários falha no navegador em produção |
| A2 | `CORS_ORIGINS` com a origem real da UI | Hoje só `http://localhost:5173` |

**Novo: `POST /api/v1/auth/register`** (desativado por padrão: `ALLOW_SELF_REGISTRATION=false`)

```http
POST /api/v1/auth/register
Content-Type: application/json
{"username":"marina.dev","email":"marina@exemplo.com","password":"senha-forte-123"}

201 Created   Cache-Control: no-store
{"access_token":"eyJ…","token_type":"bearer","expires_in":3600,"role":"user","user_id":"0192f3a4-…"}
```

| Status | `code` | Quando |
|---|---|---|
| 201 | — | Conta criada e já autenticada (mesmo corpo de `/auth/login`) |
| 403 | `registration_disabled` | `ALLOW_SELF_REGISTRATION=false` |
| 409 | `username_conflict` | Usuário ou e-mail já existe (comparação sem diferenciar maiúsculas) |
| 422 | `validation_error` | `errors[]` com `field` e `reason` (usuário 3–64 `[a-zA-Z0-9._-]`; senha 8–128; e-mail válido ou ausente) |
| 429 | `rate_limited` | Limite por IP (ex.: 5 cadastros/hora), com `Retry-After` |

Regras: papel `user`, `is_test=false`, cotas padrão configuráveis; hash de senha com argon2 ou bcrypt (nunca texto puro, nunca em log); resposta de erro em `application/problem+json` com `request_id`; teste de integração e entrada no `openapi.json`. Quando a API estiver pronta, mantenha `VITE_REGISTRATION_ENABLED=true`. Se a rota ainda não existir, a UI mostra "Esta API não oferece essa operação." (`404/405`).

**Alternativa sem mexer na API:** manter só *Entrar* e *Convidado*; contas continuam criadas pelo admin (`POST /admin/users`). Nesse caso deixe `VITE_REGISTRATION_ENABLED=false`.

---

## 8. Ordem de entrega sugerida

| PR | Conteúdo | Resultado visível |
|---|---|---|
| 1 | Fases 0 e 1 | Proxy certo, erros padronizados |
| 2 | Fases 2 e 3 | Telas de Login/Cadastro/Convidado funcionando contra `/auth/*` |
| 3 | Fase 4 | Chat real autenticado, em streaming |
| 4 | Fases 5 e 6 | Uso/modelos/saúde reais; limpeza; `npm run check` verde |
| 5 | Testes e e2e | Cobertura de auth e do contrato |
| API | Fase 8 | `/auth/register` e CORS |

---

## 9. Definição de pronto

- [ ] `curl` com token funciona e a UI faz o mesmo fluxo.
- [ ] Sem token a UI mostra o login; nenhuma requisição à API sai sem `Authorization` (exceto `/auth/*` e `/health`).
- [ ] Login, Convidado e Sair funcionam; recarregar mantém a sessão; token expirado volta ao login com aviso.
- [ ] Cadastro funciona contra `/auth/register` (ou está desativado por flag).
- [ ] Chat responde em streaming; `401`, `429` e `422` mostram mensagem útil.
- [ ] Trocar de usuário não mostra o histórico do anterior.
- [ ] Modo demo e modo clássico continuam como antes.
- [ ] `npm run check` e os e2e verdes; axe sem violações em `AuthView`; alvos ≥ 44 px; nenhum token no `dist/`.
- [ ] README e plano apontam para arquivos que existem.

---

## 10. Riscos e limites

| Risco | Mitigação |
|---|---|
| Rascunho do composer se perde quando o login de usuário expira (o `AuthGate` desmonta o HUD) | Mover `draft` para o `ui-store` (melhoria opcional) |
| `AbortSignal.any` exige navegador recente (Chrome 116+, Safari 17.4+) | Aceitável para o público atual; senão, usar um *polyfill* simples |
| Limite de emissão de convidado por IP (10/h) em redes com NAT | O token de convidado é persistido e reaproveitado |
| Token em `sessionStorage`/`localStorage` fica exposto a XSS | CSP rígida, markdown sanitizado, tokens curtos; `VITE_AUTH_STORAGE=memory` se preferir |
| Cadastro depende de mudança na API | Flag `VITE_REGISTRATION_ENABLED` e mensagem clara enquanto não existir |
| Esta análise não foi executada | Rode `npm run lint && npm run typecheck` primeiro: a lista de erros confirma (ou corrige) os itens M1 |
