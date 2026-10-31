# NEXA WEB UI — Plano de Integração com a NEXA API (Fase 7)

> Nota (31/10/2026): a interface Clássica e a pasta `web_referencia` foram removidas. As fases e itens que tratam do Clássico estão encerrados e não representam o código atual.

> **Versão:** 1.2 · **Estado:** integração API existente; fechamento de release permanece em andamento
> **Escopo:** integração da `NEXA_WEB_UI` com a `NEXA_API`, incluindo os incrementos de cadastro, personalização e BYOK.
> **Regra de ouro:** nenhuma alteração de tema. Mesmos tokens, fontes, cores, raios, tamanhos de alvo de toque e padrões de componente já existentes.
> **Base:** código atual dos repositórios NEXA_API e NEXA_WEB_UI. A análise detalhada abaixo registra o desenho inicial; use a matriz de estado atual para distinguir funcionalidades entregues de pendências.

---

## Sumário

0. [Resumo executivo](#0-resumo-executivo)
1. [Diagnóstico: contrato esperado pela UI × contrato real da API](#1-diagnóstico-contrato-esperado-pela-ui--contrato-real-da-api)
2. [Decisões de arquitetura](#2-decisões-de-arquitetura)
3. [Matriz de cobertura: API → UI](#3-matriz-de-cobertura-api--ui)
4. [Pré-requisitos e ajustes na API](#4-pré-requisitos-e-ajustes-na-api)
5. [Fases de implementação](#5-fases-de-implementação)
6. [Especificações técnicas](#6-especificações-técnicas)
7. [Diretrizes visuais (tema preservado)](#7-diretrizes-visuais-tema-preservado)
8. [Modo Clássico](#8-modo-clássico)
9. [Estratégia de testes](#9-estratégia-de-testes)
10. [Segurança e privacidade](#10-segurança-e-privacidade)
11. [Configuração, ambiente e deploy](#11-configuração-ambiente-e-deploy)
12. [Riscos e mitigação](#12-riscos-e-mitigação)
13. [O que a API não permite (limites conhecidos)](#13-o-que-a-api-não-permite-limites-conhecidos)
14. [Definição de pronto](#14-definição-de-pronto)
- [Apêndice A — Catálogo de erros → mensagens PT-BR](#apêndice-a--catálogo-de-erros--mensagens-pt-br)
- [Apêndice B — Tipos TypeScript do contrato](#apêndice-b--tipos-typescript-do-contrato)
- [Apêndice C — Árvore de arquivos](#apêndice-c--árvore-de-arquivos)
- [Apêndice D — Exemplos de requisição/resposta](#apêndice-d--exemplos-de-requisiçãoresposta)

---

## 0. Resumo executivo

### Estado atual da implementação

| Bloco | Estado | Evidência funcional |
|---|---|---|
| F7.0–F7.3 — base, autenticação e chat | Implementado | Adaptador HTTP, cadastro/guest/login, streaming JSON/SSE |
| F7.4 — catálogo e seleção de modelos | Implementado | Lista multi-provedor e origem de chave |
| F7.5 — cotas e limites | Implementado no chat | Usage do evento final e cabeçalhos; estados de erro tratados no cliente |
| F7.6 — saúde | Implementado | Health da API usado no painel e interface clássica |
| F7.7 — monitor | Parcialmente implementado | Health, uso, modelos e provedores; faltam estatísticas/admin de guests e banco |
| F7.8 — usuários de teste | Pendente na Web | A API tem rotas; não há UI de CRUD administrativo correspondente |
| F7.9 — nome e memórias no contexto | Implementado | `personalization` envia nome/memórias ativas e API monta contexto servidor-gerado |
| F7.10 — modo clássico | Implementado | Chat/sessões, memória, busca local, ajustes, monitor e voz reais; scan consulta API e prévia animada de gestos executa atalhos sem alegar detecção por câmera |
| F7.11 — integrações e sobre | Implementado | Monitor mostra carta visual com origem/versão, links para docs e exemplos copiáveis para OpenAI, Anthropic e Ollama |
| F7.12 — fechamento | Em andamento | Há validações anteriores registradas neste plano; reexecute a suíte completa após as mudanças mais recentes. Auditoria completa de a11y, API sem avisos e live-provider continuam pendentes |

O histórico de diagnóstico e as matrizes abaixo foram escritos antes da integração.
Onde descrevem endpoints inexistentes, login ausente ou clássico simulado, são
registro histórico; a matriz acima e o README representam o estado do código.

O modo OFFLINE com Ollama foi implementado como capacidade separada e não integra o escopo da API NEXA. A interface bloqueia chamadas à API quando esse modo está ativo. Para uso pela rede local, o Vite serve `/ollama` como proxy same-origin até `127.0.0.1:11434`; detalhes estão em [`PLANO_MODO_OFFLINE_OLLAMA.md`](PLANO_MODO_OFFLINE_OLLAMA.md).

A UI foi construída (fases 0–6) contra um **contrato hipotético** de API com sessões no servidor. A API real é **diferente em pontos estruturais**. Integrar não é "trocar a URL": exige refatorar a camada `src/api/` e partes de `features/chat`.

### As 8 descobertas que mudam o plano

| # | Descoberta | Consequência para a UI |
|---|---|---|
| 1 | **A API não tem sessões nem histórico** (`RF-CHAT-06`, `RN-05`, `RD-14`). Só existe `POST /api/v1/chat`, que recebe a **lista completa de mensagens** a cada chamada. | Sessões e mensagens ficam **100% locais** (IndexedDB). O `HttpChatAdapter` atual (`/chat/sessions/*`) é descartado e reescrito. |
| 2 | **O SSE real é diferente do esperado.** Trechos vêm como `data: {"content": "..."}` (sem `event:`), o fim vem como `event: done`, falhas como `event: error`, heartbeat como `: ping`. **Não existe `[DONE]`, `token` nem `meta`.** | Parser SSE novo. Falta de `done`/`error` ao fim do fluxo = conexão interrompida. |
| 3 | **Tudo exige Bearer JWT**, exceto `/auth/*` e `/health*`. Não há refresh token (`RF-AUT-09`). | Criar camada de autenticação: **guest automático**, login de admin/usuário de teste, expiração tratada, 401 → reemissão ou reautenticação. |
| 4 | **Cota diária e por minuto são parte do produto** (guest 10/dia e 3/min por padrão; IP 30/dia). | `UsageMeter`, contagem regressiva de `Retry-After`, bloqueio do composer com `resets_at`. |
| 5 | **Limites de contexto por papel** (guest/usuário: 20 mensagens × 2000 caracteres; admin: 100 × 8000). Respostas do assistente podem passar de 2000 caracteres (`AI_MAX_OUTPUT_TOKENS=1024`). | Um **`fitContext()`** é obrigatório: sem ele, a 2ª ou 3ª pergunta de um guest já falha com `422`. |
| 6 | **Rotas `/health*` ficam na raiz**, não em `/api/v1`. O proxy do Vite só cobre `/api` e aponta para `:3001`; a API sobe em `:8000`. | Derivar `apiOrigin`, ajustar proxy e `.env.example`. |
| 7 | **CORS da API libera só `GET, POST, OPTIONS`** (`ALLOWED_METHODS` em `app/main.py`). | `PATCH` e `DELETE` (gestão de usuários) são **bloqueados no navegador**. Ajuste de 1 linha na API (seção 4). |
| 8 | **Não existem** `/auth/refresh`, `/auth/me`, `/memory`, `/settings`, `/search`, `/system/status` nem WebSocket de telemetria (previstos no plano antigo). | Memória, ajustes e busca continuam **locais**. Telemetria = *polling* de `/admin/stats` e `/health*`. |

### O que será entregue

- **Chat real** com streaming SSE, modo JSON, escolha de modelo, tratamento completo de `finish_reason`, `tool_calls` (exibição), uso de tokens e `X-Request-ID`.
- **Autenticação**: convidado transparente, login de admin e de usuário de teste, logout, expiração.
- **Catálogo de modelos** multi-provedor com capacidades e `selectable`.
- **Cotas e limites** visíveis e respeitados.
- **Saúde da API** real nos chips da TopBar e no painel de contexto.
- **Monitor** (hoje placeholder "em construção") com dados reais; visão pública e visão de admin (estatísticas, provedores, guests, banco).
- **Gestão de usuários de teste** (criar, lote, listar com cursor, editar, redefinir senha, excluir, limpar expirados, zerar cota).
- **Modo Clássico** ligado à API (console, monitor), sem alterar layout.
- **Painel "Integrações"**: exemplos prontos para OpenAI/Anthropic (Claude Code)/Ollama apontando para a API, sem expor chaves.
- **Testes** (unitário, contrato contra o OpenAPI, e2e com API simulada e e2e opcional contra a API real com provedor `fake`).

### Estimativa

| Bloco | Dias úteis |
|---|---|
| Caminho crítico (F7.0 a F7.6: fundação, auth, chat, modelos, cotas, saúde) | ~9–10 |
| Monitor + usuários (F7.7, F7.8) | ~5–5,5 |
| Memória-contexto, clássico, integrações (F7.9 a F7.11) | ~3 |
| Testes, a11y, performance, documentação (F7.12) | ~2 |
| **Total** | **~20** (estimativa original do plano antigo: 3–5, baseada num contrato que não existe) |

---

## 1. Diagnóstico: contrato esperado pela UI × contrato real da API

### 1.1 Divergências por área

| Área | UI hoje (`src/api`, `features/chat`) | API real | Ação |
|---|---|---|---|
| Sessões | `GET/POST/PATCH/DELETE /chat/sessions[/id]` | **Inexistente** | Repositório local (IndexedDB), por identidade |
| Mensagens | `GET /chat/sessions/:id/messages` | **Inexistente** | Idem |
| Envio | `POST /chat/sessions/:id/messages` com `{content}` | `POST /api/v1/chat` com `{messages[], stream, model?, tools?, tool_choice?}` | Montar contexto completo (`fitContext`) |
| Streaming | `event: token/meta/done/error` com `value/sessionId/usage{input,output}` | `data:{content,tool_calls?}` + `event: done {status,finish_reason,model_id,provider_usage,usage}` + `event: error {code,detail,request_id}` + `: ping` | Reescrever `parseSseFrame` |
| Erros | Lê `title/message/detail` | Problem Details com `code`, `status`, `detail`, `request_id`, `errors[]`, `resets_at` + `Retry-After` | `ApiError` enriquecida + catálogo PT-BR (Apêndice A) |
| Autenticação | `getAccessToken` nunca fornecido | `Authorization: Bearer <JWT>` obrigatório | `auth-store` + `ensureToken()` |
| Modelo | Chip fixo `nexa-mock-1` / `nexa-remote` | `GET /models`, campo `model` no chat | `ModelPicker` |
| Cotas | Inexistente | `usage`, `X-RateLimit-*`, `Retry-After`, `429` com 6 códigos | `UsageMeter` + estados de bloqueio |
| Health | Chip "api conectada" = `!demoMode` | `/health`, `/health/ready`, `/health/db` (raiz) | `useApiHealth` |
| Monitor | `ModuleView` placeholder | `/admin/stats`, `/admin/ai/status`, `/admin/guests`, `/admin/db/status` | `features/monitor` |
| Usuários | Inexistente | `/admin/users*` (8 operações) | `features/admin/users` |
| Memória | IndexedDB local | **Sem endpoint** | Permanece local |
| Proxy dev | `/api` → `:3001` | API em `:8000`; `/health` na raiz | Atualizar `vite.config.ts` e `.env.example` |
| Texto de documentação | README: "com a API real, o histórico vem do backend" | Falso | Corrigir README e plano antigo |

### 1.2 Pontos do código atual que precisam mudar (mapa rápido)

| Arquivo | Mudança |
|---|---|
| `src/api/types.ts` | Estender `ChatStreamEvent`, `ChatStreamInput`, `Session.modelId?`, `ChatMessage.meta?` |
| `src/api/adapters/http.ts` | **Reescrever** (compõe repositório local + cliente HTTP da API) |
| `src/api/adapters/mock.ts` | Emitir os mesmos eventos novos (usage/model/finish) para o modo demo continuar fiel |
| `src/api/index.ts` | Instanciar repositório local por identidade e injetar `getAccessToken` |
| `src/features/chat/use-chat.ts` | Passar `model`, tratar `finish_reason`, `usage`, erros por `code`, 401/429 |
| `src/features/chat/ChatView.tsx` | Trocar chips estáticos por `ModelPicker` + status reais |
| `src/features/chat/Composer.tsx` | Contador de caracteres, bloqueio por cota/limite, `UsageMeter` |
| `src/features/chat/MessageBubble.tsx` | Rodapé de metadados, `tool_calls`, avisos de `finish_reason` |
| `src/features/layout/TopBar.tsx` | Chips reais (API/saúde) + chip de identidade |
| `src/features/layout/ContextPanel.tsx` | Subsistemas reais, uso, modelo, tokens; remover item "Monitor — fase 7" |
| `src/features/layout/ModuleView.tsx` | Substituído por `features/monitor` |
| `src/features/settings/SettingsView.tsx` | Cartões CONTA, MODELO, CONEXÃO (teste), INTEGRAÇÕES, SOBRE |
| `src/features/notifications/ConnectionNotifier.tsx` | Também notificar API fora/dentro do ar |
| `src/features/classic/*` | Console e monitor conectados (seção 8) |
| `vite.config.ts`, `.env.example` | Proxy `/api` + `/health`, alvo `:8000` |
| `tests/api/http-chat-adapter.test.ts` | Reescrever para o contrato real |

---

## 2. Decisões de arquitetura

### D1 — Histórico local-first, namespaced por identidade

A API é *stateless* para conteúdo. A UI passa a ser a **dona do histórico**:

- Persistência em IndexedDB, chave **por identidade**: `nexa:chat:v2:guest`, `nexa:chat:v2:user:<user_id>` (admin e usuário de teste usam o `user_id` retornado no login).
- O modo demo continua em `nexa:chat:v1` (não mistura conteúdo simulado com real).
- Trocar de identidade (login/logout) **troca de namespace**, limpa o cache do TanStack Query (`sessions`, `messages`) e zera `activeSessionId`. Assim, o histórico de um admin não aparece para o próximo guest no mesmo navegador.
- O contrato `ChatAdapter` que a UI consome **não muda de forma** (`listSessions`, `createSession`, `renameSession`, `deleteSession`, `listMessages`, `streamReply`), o que limita o impacto em `useSessions`, `useMessages`, `SessionsSidebar` e `AppShell`.

```
ChatAdapter (contrato da UI, inalterado)
 ├─ MockChatAdapter        (demo: repositório v1 + respostas locais)
 └─ HttpChatAdapter        (real)
      ├─ LocalChatRepository  ← sessões/mensagens (IndexedDB, por identidade)
      └─ NexaApiClient        ← /auth, /chat, /models, /usage, /admin, /health
```

### D2 — Um único cliente HTTP

`src/api/client/` concentra: URL base/origem, `Authorization`, `X-Request-ID` (UUID por requisição), parse de Problem Details, `Retry-After`, cabeçalhos `X-RateLimit-*`, timeouts e `AbortSignal`. Nenhuma `fetch` solta em componentes.

### D3 — Tipos derivados do OpenAPI

- `openapi-typescript` (devDependency) gera `src/api/generated/openapi.d.ts` a partir de `tests/snapshots/openapi.json` da API (ou de `GET /openapi.json`).
- Script `npm run api:types` (gera) e `npm run api:types:check` (CI: falha se o arquivo versionado divergir).
- Validação em tempo de execução com `zod` (já instalado) **apenas** onde um erro silencioso machuca: resposta de login, `usage`, `models` e payload do evento `done`.

### D4 — Autenticação

- **Convidado automático**: o primeiro uso que precisa de token chama `POST /auth/guest` (uma vez, *single-flight*) e guarda o token.
- **Login**: `POST /auth/login` serve admin **e** usuário de teste (o papel vem em `role`).
- Armazenamento (decisão a confirmar — ver risco R3 na seção 12):
  - token de **convidado** em `localStorage` (`nexa:auth:guest:v1`): é anônimo e de baixo privilégio; reemitir a cada recarga queimaria o limite de emissão por IP (`GUEST_TOKENS_PER_IP_PER_HOUR=10`) e geraria um `gid` novo a cada vez;
  - token de **admin/usuário** em `sessionStorage` (`nexa:auth:session:v1`): some ao fechar a aba, mantém a sessão no *reload*. Opção `VITE_AUTH_STORAGE=memory` para exigir login a cada *reload*.
- Sem refresh token: ao receber `401`, convidado reemite (1 tentativa); admin/usuário abre o diálogo de login **preservando o rascunho**.

### D5 — Estado

| Tipo | Ferramenta | Itens |
|---|---|---|
| Servidor | TanStack Query | `usage`, `models`, `health`, `admin.*`, `users.*` |
| Sessão/identidade | Zustand | `auth-store` (token, papel, `user_id`, expiração) |
| Preferência de modelo | Zustand + `localStorage` | `nexa:model:v1` |
| Histórico | IndexedDB (via repositório) + Query | `sessions`, `messages` (mesmo padrão atual) |
| Streaming em curso | Estado local do `use-chat` (como hoje) | — |

Cotas **não** são re-buscadas a cada mensagem: atualizadas por `setQueryData` a partir dos cabeçalhos `X-RateLimit-*` (início do stream) e do `usage` do evento `done`/resposta JSON. `GET /usage` roda no boot, após erro e ao voltar o foco.

### D6 — Admin em *chunk* separado

`features/monitor` e `features/admin` entram por `React.lazy` (mesmo padrão de `SettingsView`/`MemoryView`), preservando o orçamento de **< 300 KB gzip** do chunk inicial (hoje ~162 KB).

### D7 — Rotas de compatibilidade **não** são consumidas pelo navegador

`/v1/*` e `/api/chat|tags|show|ps` usam chave `nxa_...` e envelopes de erro próprios. A UI não as chama. Ela apenas **documenta** o uso (seção F7.11) sem pedir nem armazenar chaves.

### D8 — Modo demo continua existindo

Útil para desenvolvimento offline e demonstração. O banner de demonstração permanece. Se a API estiver inacessível no *boot*, oferecer ação "Usar modo demonstração" (P2).

---

## 3. Matriz de cobertura: API → UI

Legenda de prioridade: **P0** obrigatório · **P1** importante · **P2** desejável.

### 3.1 Rotas nativas (`/api/v1`)

| Método | Rota | Papel | Recurso na UI | Onde | Fase | Prio |
|---|---|---|---|---|---|---|
| POST | `/auth/guest` | público | Token de convidado transparente | `auth-store` | F7.2 | P0 |
| POST | `/auth/login` | público | Login admin / usuário de teste | `LoginDialog`, Ajustes › Conta | F7.2 | P0 |
| POST | `/auth/register` | público, se habilitado | Cadastro de conta com token autenticado | Login/Cadastro | F18 | P1 |
| GET | `/me/providers` | user/admin | Lista provedores BYOK configurados (sem revelar chaves) | Monitor › IA e Chaves | F18 | P1 |
| PUT | `/me/providers/{provider}` | user/admin | Salva/substitui chave BYOK | Monitor › IA e Chaves | F18 | P1 |
| DELETE | `/me/providers/{provider}` | user/admin | Remove chave BYOK | Monitor › IA e Chaves | F18 | P1 |
| POST | `/me/providers/{provider}/test` | user/admin | Testa credencial BYOK sem expô-la | Monitor › IA e Chaves | F18 | P1 |
| GET | `/usage` | qualquer | `UsageMeter`, estado do composer | Composer, ContextPanel, TopBar | F7.5 | P0 |
| POST | `/chat` (`stream=true`) | qualquer | Streaming SSE | `use-chat`, `HttpChatAdapter` | F7.3 | P0 |
| POST | `/chat` (`stream=false`) | qualquer | Modo JSON (alternativa e *fallback* por capacidade) | `HttpChatAdapter` | F7.3 | P0 |
| GET | `/models` (`?refresh=true`) | qualquer | `ModelPicker`, modelo padrão | ChatView, Ajustes | F7.4 | P0 |
| GET | `/admin/stats` | admin | Cartões de estatísticas | Monitor › Visão geral | F7.7 | P1 |
| GET | `/admin/ai/status` | admin | Saúde dos provedores | Monitor › Provedores | F7.7 | P1 |
| GET | `/admin/guests` | admin | Guests ativos + uso por IP | Monitor › Guests | F7.7 | P1 |
| POST | `/admin/usage/reset` | admin | Zerar cota de `gid`/`ip`/`uid` | Monitor › Guests e Usuários | F7.7/F7.8 | P1 |
| GET | `/admin/db/status` | admin | Status/latência do SQLite | Monitor › Banco | F7.7 | P1 |
| POST | `/admin/users` | admin | Criar usuário de teste | Usuários › Novo | F7.8 | P1 |
| POST | `/admin/users/bulk` | admin | Criar em lote (+ CSV) | Usuários › Lote | F7.8 | P1 |
| GET | `/admin/users` | admin | Lista com cursor e filtros | Usuários | F7.8 | P1 |
| GET | `/admin/users/{id}` | admin | Detalhe/refresh de linha | Usuários › Editar | F7.8 | P1 |
| PATCH | `/admin/users/{id}` | admin | Editar limites, ativo, expiração | Usuários › Editar | F7.8 | P1 |
| POST | `/admin/users/{id}/reset-password` | admin | Redefinir senha (exibição única) | Usuários | F7.8 | P1 |
| DELETE | `/admin/users/{id}` | admin | Excluir usuário de teste | Usuários | F7.8 | P1 |
| POST | `/admin/users/cleanup` | admin | Remover expirados | Usuários | F7.8 | P1 |

### 3.2 Sistema

| Método | Rota (raiz) | Recurso na UI | Fase | Prio |
|---|---|---|---|---|
| GET | `/health` | Chip "API conectada", versão, latência | F7.6 | P0 |
| GET | `/health/ready` | Provedores e banco (público) | F7.6/F7.7 | P1 |
| GET | `/health/db` | Estado do banco (Monitor) | F7.7 | P2 |
| GET | `/docs`, `/redoc`, `/openapi.json` | Links em Ajustes › Sobre | F7.11 | P2 |

### 3.3 Compatibilidade (não consumida; apenas documentada)

| Rota | Tratamento |
|---|---|
| `POST /v1/chat/completions`, `GET /v1/models` | Exemplo "OpenAI" na carta de integração do Monitor |
| `POST /v1/messages`, `/v1/messages/count_tokens` | Snippet "Claude Code" (variáveis `ANTHROPIC_*`) |
| `POST /api/chat`, `GET /api/tags`, `POST /api/show`, `GET /api/ps` | Snippet "Ollama" |

### 3.4 Recursos de protocolo que a UI precisa honrar

| Recurso | Tratamento |
|---|---|
| `X-Request-ID` (enviar UUID, ler na resposta) | Exibido em detalhes de erro, copiável (suporte) |
| `X-RateLimit-Limit/Remaining/Reset` | Atualizam o `UsageMeter` já no início do stream |
| `Retry-After` | Contagem regressiva (429 por minuto, `login_locked`, `guest_token_limit_reached`) |
| `resets_at` (Problem Details e `usage`) | Hora de renovação em horário local |
| `errors[]` (422) | Mensagens por campo (usuários) e correção automática de limites (chat) |
| `finish_reason` = `stop`/`length`/`timeout`/`tool_use` | Avisos e ações (continuar) |
| `provider_usage` (tokens) | Rodapé da mensagem e painel de contexto |
| `tool_calls` | Exibição somente leitura (ver seção 13) |
| Heartbeat `: ping` | Reinicia o *watchdog* de inatividade |

---

## 4. Pré-requisitos e ajustes na API

### 4.1 Obrigatório (bloqueia a gestão de usuários)

| # | Ajuste | Onde | Por quê |
|---|---|---|---|
| A1 | Incluir `PATCH` e `DELETE` em `ALLOWED_METHODS` | `app/main.py` (hoje `["GET", "POST", "OPTIONS"]`) | O *preflight* de `PATCH /admin/users/{id}` e `DELETE /admin/users/{id}` falha no navegador. Sem isso, editar, desativar e excluir usuários **não funciona** na UI (em dev, o proxy do Vite mascara o problema; em produção com origens distintas, não). Atualizar também `tests/integration/test_system.py::test_cors_preflight`. |
| A2 | `CORS_ORIGINS` com a origem real da UI | `.env` da API | Hoje só `http://localhost:5173`. Em produção, a URL do deploy (Cloudflare Pages/Vercel). |

> Alternativa sem alterar a API: em **desenvolvimento**, usar o proxy do Vite (mesma origem, sem CORS). Em produção, servir UI e API sob o mesmo domínio via proxy reverso. Mesmo assim, recomenda-se A1.

### 4.2 Recomendado (não bloqueia; melhora a UX)

| # | Sugestão | Benefício |
|---|---|---|
| R1 | Expor os limites efetivos do papel em `GET /usage` (ex.: `max_messages`, `max_message_chars`) | A UI deixa de usar valores padrão e de *adivinhar* via erro `422` |
| R2 | `GET /api/v1/auth/me` (papel, `user_id`, `username`, expiração) | Restaurar identidade sem decodificar JWT |
| R3 | Enviar `model_id` num primeiro evento SSE (ex.: `event: start`) | Mostrar o modelo real (após alias/fallback) durante o streaming, não só ao final |
| R4 | Documentar no OpenAPI os cabeçalhos `X-RateLimit-*` e `Retry-After` nas respostas `429` (já são enviados por `_consume_or_raise`) | Tipos gerados passam a refletir os cabeçalhos que a UI lê |

### 4.3 Ambiente de desenvolvimento e testes com a API

Subir a API local (sem Ollama), com o provedor determinístico `fake`:

```bash
# .env da API (desenvolvimento)
ENVIRONMENT=development
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<hash gerado por scripts/hash_password.py>
JWT_SECRET=dev-secret-com-pelo-menos-32-bytes-aleatorios
AI_ENABLED_PROVIDERS=fake
AI_DEFAULT_MODEL=fake/fake-model
CORS_ORIGINS=http://localhost:5173
ALLOW_TEST_USERS=true
```

> Validar o valor exato de `AI_DEFAULT_MODEL` para o `fake` na primeira execução (`GET /api/v1/models` mostra os `model_id` reais).

---

## 5. Fases de implementação

Convenção de cada fase: **Objetivo → Tarefas → Arquivos → Critérios de aceite**. Cada fase termina com `npm run check` verde e a e2e correspondente.

### Visão geral e dependências

```
F7.0 Fundação ─► F7.1 Cliente HTTP ─► F7.2 Autenticação ─► F7.3 Chat ─┬─► F7.4 Modelos
                                                                      ├─► F7.5 Cotas
                                                                      └─► F7.6 Saúde
F7.2 ─► F7.7 Monitor ─► F7.8 Usuários (exige ajuste A1 na API)
F7.3 ─► F7.9 Memória→contexto · F7.10 Clássico · F7.11 Integrações
tudo ─► F7.12 Testes, a11y, performance, documentação
```

---

### F7.0 — Fundação e ambiente (≈ 1 dia)

**Objetivo:** preparar o projeto para falar com a API real sem quebrar o modo demo.

**Tarefas**
1. `vite.config.ts`: proxy `/api` **e** `/health` → `env.VITE_API_PROXY || 'http://localhost:8000'` (hoje `:3001`). Opcional: `/docs`, `/redoc`, `/openapi.json`.
2. `.env.example`: `VITE_API_PROXY=http://localhost:8000`; novos `VITE_AUTH_STORAGE=session` e `VITE_LIMIT_*` opcionais (seção 11).
3. `src/api/config.ts`: derivar `apiBase` e `apiOrigin` de `settings.apiUrl` (função pura, testável).
4. Instalar `openapi-typescript` (dev) e criar scripts `api:types` / `api:types:check`; versionar `src/api/generated/openapi.d.ts` e uma cópia do `openapi.json` usada nos testes de contrato.
5. Corrigir documentação enganosa: README ("o histórico vem do backend") e `docs/PLANO_DE_IMPLEMENTACAO.md` (seções 7 e 8: contrato sugerido, fase 7).
6. Criar `docs/INTEGRACAO_API.md` com este plano resumido e o fluxo de execução local.

**Arquivos:** `vite.config.ts`, `.env.example`, `package.json`, `src/api/config.ts`, `src/api/generated/*`, `README.md`, `docs/*`.

**Aceite**
- `npm run dev` + API em `:8000`: `curl localhost:5173/health` e `curl localhost:5173/api/v1/models -i` (401) respondem via proxy.
- `apiOrigin('/api/v1') === ''` (mesma origem) e `apiOrigin('https://api.x.com/api/v1') === 'https://api.x.com'`.
- Modo demo inalterado (suíte atual verde).

---

### F7.1 — Cliente HTTP e tratamento de erros (≈ 1,5 dia)

**Objetivo:** uma base única, testada, para todas as chamadas.

**Tarefas**
1. `src/api/client/http.ts`: `request<T>(path, { method, body, auth, signal, timeoutMs, query })`.
   - `Accept: application/json`; `Content-Type: application/json` **somente quando há corpo** (a API responde `415` a corpo não-JSON).
   - `X-Request-ID`: `crypto.randomUUID()` por requisição (a API aceita UUID válido e o devolve nos erros e logs).
   - `Authorization: Bearer` quando `auth !== false`.
   - Timeout padrão 130 s (a API usa `AI_TIMEOUT_SECONDS=120`) combinado ao `signal` do chamador (`AbortSignal.any`).
   - Respostas `204` → `undefined`.
2. `src/api/client/problem.ts`: `ApiError` enriquecida (substitui a atual):
   ```ts
   class ApiError extends Error {
     status: number; code: string; title: string; detail?: string;
     requestId?: string; errors?: { field: string; reason: string }[];
     retryAfter?: number;   // segundos (cabeçalho Retry-After)
     resetsAt?: string;     // ISO UTC (corpo)
   }
   ```
   Parse de `application/problem+json` e fallback para corpo não-JSON (`Erro 502`), preservando `X-Request-ID` do cabeçalho.
3. `src/api/client/rate-limit.ts`: ler `X-RateLimit-Limit/Remaining/Reset` e `Retry-After` de qualquer resposta.
4. `src/api/errors.ts`: catálogo `code → { título, mensagem PT-BR, ação }` (Apêndice A) e `describeError(error)` usado por notificações e banners.
5. Erro de rede (`TypeError: Failed to fetch`) → `ApiError` sintético `code: 'network_error'`, distinguindo de CORS mal configurado na mensagem de diagnóstico ("Verifique a URL da API e o CORS").

**Arquivos:** `src/api/client/{http,problem,rate-limit}.ts`, `src/api/errors.ts`, `src/api/index.ts`.

**Aceite**
- Testes: Problem Details completo, corpo vazio, HTML de proxy (502), `Retry-After` numérico, `204`, *abort*, *timeout*, `X-Request-ID` enviado e lido.

---

### F7.2 — Autenticação e identidade (≈ 1,5 dia)

**Objetivo:** toda chamada autenticada tem um token válido e o usuário sabe quem é.

**Tarefas**
1. `src/stores/auth-store.ts` (Zustand):
   ```ts
   interface AuthState {
     role: 'guest' | 'user' | 'admin' | null;
     userId: string | null;       // null para guest
     username: string | null;
     token: string | null;
     expiresAt: number | null;    // epoch ms (agora + expires_in − 30 s de folga)
     status: 'idle' | 'authenticating' | 'ready' | 'expired';
   }
   ```
2. `src/api/auth.ts`:
   - `ensureToken()` — devolve token válido; se não houver, emite convidado (`POST /auth/guest`) com *single-flight* (várias chamadas simultâneas compartilham uma promessa).
   - `login(username, password)` → grava papel, `user_id`, expiração; invalida cache de chat (D1).
   - `logout()` → descarta token e volta a convidado (novo namespace local).
   - `handleUnauthorized()` — convidado: reemite e sinaliza "pode repetir 1 vez"; admin/usuário: `status = 'expired'`, abre `LoginDialog` e mantém o rascunho.
   - Agendamento: 2 min antes de `expiresAt`, notificar admin/usuário ("Sua sessão expira em 2 minutos"); convidado reemite em silêncio.
3. `src/features/auth/LoginDialog.tsx` — `<dialog>` nativo (mesmo padrão de `SessionsSheet`), campos usuário/senha, `autocomplete` correto, foco preso, `Esc` fecha.
   - `invalid_credentials` → mensagem genérica (a API não revela se o usuário existe).
   - `login_locked` (429) → contagem regressiva com `Retry-After`; botão desabilitado até zerar.
   - `network_error` → mensagem de conexão.
4. TopBar: chip de identidade (`convidado` · `admin` · `<username>`) com menu Entrar/Sair (oculto abaixo de `md`; no mobile a ação fica em Ajustes › Conta).
5. Ajustes › **CONTA** (novo `SectionCard`): identidade, papel, expiração do token, Entrar/Sair.
6. Ao trocar de identidade: `queryClient.removeQueries` (`sessions`, `messages`, `usage`, `admin.*`), `setActiveSessionId(null)`.

**Arquivos:** `src/stores/auth-store.ts`, `src/api/auth.ts`, `src/features/auth/LoginDialog.tsx`, `TopBar.tsx`, `SettingsView.tsx`, `src/api/index.ts` (injeta `getAccessToken`).

**Aceite**
- Primeiro envio como visitante: exatamente **1** `POST /auth/guest`, mesmo com 3 chamadas concorrentes.
- *Reload* mantém o convidado (mesmo `gid`) e a sessão de admin (na aba).
- Login de admin → role `admin`, token em `sessionStorage`, nenhum token em `localStorage` além do de convidado.
- Token expirado de admin → diálogo de login, rascunho preservado, histórico intacto.
- 6ª tentativa de login errada → bloqueio com contagem regressiva.

---

### F7.3 — Chat real: contexto, SSE, JSON, `finish_reason`, `tool_calls` (≈ 3 dias)

**Objetivo:** conversa funcional contra `POST /api/v1/chat`, com histórico local.

**Tarefas**

1. **Repositório local** `src/api/storage/local-chat-repository.ts`
   - Extrai de `MockChatAdapter` a lógica de sessões/mensagens/persistência (`Map`, fila de gravação, `hydrate`), parametrizada por `namespace`.
   - O `MockChatAdapter` passa a usá-lo (comportamento idêntico em demo).
   - Sem *seed* de "Boas-vindas" no modo real (conversa vazia com sugestões).

2. **Construção de contexto** `src/features/chat/context.ts` → `fitContext()` (spec na seção 6.3). Chamado pelo adaptador antes de cada envio.

3. **Cliente de chat** `src/api/chat.ts`
   - `streamChat(body, { signal })` → `AsyncIterable<ChatStreamEvent>`: `fetch` + `ReadableStream`, `Accept: text/event-stream`. Antes do primeiro byte lê **cabeçalhos** (`X-RateLimit-*`, `X-Request-ID`) e emite `meta`.
   - `completeChat(body)` (`stream: false`) → `ChatCompletion` (inclui `message`, `provider`, `model`, `model_id`, `finish_reason`, `provider_usage`, `usage`).
   - **Parser SSE** novo (spec 6.2); *watchdog* de 75 s sem bytes (heartbeat do servidor vem a cada 15 s; inatividade do provedor aborta aos 60 s).

4. **`HttpChatAdapter` reescrito** (`src/api/adapters/http.ts`)
   - Sessões/mensagens → `LocalChatRepository`.
   - `streamReply`: grava a mensagem do usuário, monta contexto, chama `streamChat`/`completeChat`, acumula `content`, persiste ao fim (`done`), marca `stopped`/`error` conforme o caso.
   - Em modo JSON, devolve o texto como **um único** evento `token` (a UI não precisa saber a diferença).
   - Parâmetro `stream`: preferência em Ajustes (padrão `true`) **e** forçado a `false` quando o modelo escolhido não tem a capacidade `stream` (evita `422 unsupported_capability`).

5. **`ChatStreamEvent` estendido** (Apêndice B) — o mock passa a emitir `meta`/`done` equivalentes (modelo `nexa-mock-1`, tokens simulados).

6. **`use-chat.ts`**
   - Passa `modelId` e `stream`.
   - Registra `receivedToken` para saber se a cota foi devolvida: erro **antes** do primeiro token ⇒ "nenhuma mensagem foi debitada" (RF-USO-05).
   - Erros por `code` (Apêndice A), com ação: *tentar novamente* (502/503/504), *aguardar* (429 minuto), *entrar* (429 diário de guest), *trocar de modelo* (422 de modelo), *reduzir mensagem* (422 de tamanho).
   - `401` → `handleUnauthorized()` e, se convidado reemitido e **nenhum token entregue**, repete 1 vez automaticamente.
   - *Abort* (`Stop`): `AbortController.abort()` cancela o stream; a API cancela o provedor (RF-CHAT-07). Mensagem fica `stopped`. Se nenhum trecho chegou, a cota é devolvida pelo servidor → `usage` refeito por `GET /usage`.
   - Título automático: se a sessão ainda se chama "Nova conversa", renomear com os primeiros ~48 caracteres da 1ª mensagem (repositório local).

7. **Mensagem do assistente enriquecida** (`ChatMessage.meta`): `modelId`, `finishReason`, `promptTokens`, `completionTokens`, `requestId`, `toolCalls`. Persistido localmente; sem dados sensíveis.

8. **`MessageBubble`** (mesmo layout):
   - Rodapé existente (hora · "transmitindo" · nota de status) ganha, no mesmo estilo `font-mono text-[10px] uppercase text-muted/60`: `modelo · N tokens`.
   - `finish_reason = length` → nota "Resposta cortada pelo limite de tamanho" + botão **Continuar** (envia "Continue de onde parou." como nova mensagem).
   - `finish_reason = timeout` → nota "Resposta cortada pelo limite de tempo" + **Continuar**.
   - `finish_reason = tool_use` ou `tool_calls` presentes → cartões compactos (nome da função + argumentos JSON em bloco monoespaçado), somente leitura.
   - Erro: botão "Copiar ID da requisição" quando houver `requestId`.

9. **Composer**
   - Contador `n/limite` quando passar de 80% do limite do papel; bloqueio de envio acima do limite com mensagem inline.
   - Estados desabilitados com dica: sem cota, `rate_limited` (contagem), sem rede, carregando.

**Arquivos:** `src/api/chat.ts`, `src/api/sse.ts`, `src/api/adapters/{http,mock}.ts`, `src/api/storage/local-chat-repository.ts`, `src/api/types.ts`, `src/features/chat/{use-chat,context,Composer,MessageBubble,ChatView}.tsx|ts`.

**Aceite**
- Mensagem como visitante → resposta em streaming; recarregar a página preserva a conversa.
- 6 trocas seguidas com respostas longas **não** geram `422` (graças ao `fitContext`).
- "Parar" interrompe de verdade (conexão encerrada, mensagem `stopped`).
- Queda de conexão no meio do stream (sem `done`) → mensagem `error` com texto parcial preservado.
- Troca para modelo sem `stream` usa JSON sem erro.
- `length`/`timeout` mostram nota e botão **Continuar**.

---

### F7.4 — Catálogo e seleção de modelos (≈ 1 dia)

**Objetivo:** o usuário escolhe o modelo e entende suas capacidades.

**Tarefas**
1. `src/api/models.ts` + `useModels()` (`GET /models`, `staleTime` 60 s; ação "Atualizar" usa `?refresh=true`).
2. `src/stores/model-store.ts`: `selectedModelId: string | null` (`null` = "Automático", **omite** o campo `model` e usa o padrão do servidor). Persistido em `nexa:model:v1`.
3. `src/features/chat/ModelPicker.tsx`
   - Substitui o chip estático (`nexa-mock-1`/`nexa-remote`) no cabeçalho do `ChatView`; mesma aparência de chip, com `ChevronDown`.
   - Abre `<dialog>` (padrão `nexa-sheet`) com: busca (se > 8 modelos), grupos por provedor com indicador de disponibilidade, linha por modelo (nome, família, parâmetros, quantização, tamanho em GB/MB, janela de contexto "128k", chips de capacidade `chat · stream · tools · vision · json`).
   - `selectable: false` → linha desabilitada, dica "Não permitido pelo servidor".
   - Provedor `available: false` → grupo esmaecido com aviso.
   - Rodapé: botão "Atualizar catálogo" e modelo padrão atual.
4. Auto-correção: `model_not_found`/`model_not_allowed` → volta para "Automático", atualiza catálogo e avisa por notificação.
5. Capacidades condicionam a UI: sem `stream` → JSON; sem `tools` → o envio de `tools` nunca é feito (API devolveria `unsupported_capability`).
6. Por sessão: `Session.modelId?` opcional; ao abrir uma conversa, restaura o modelo dela (se ainda existir e for selecionável).

**Aceite**
- Lista agrupada por provedor; modelo não permitido aparece desabilitado.
- Escolher modelo → próxima requisição leva `"model": "provider/model"`; "Automático" → corpo **sem** `model`.
- Catálogo fora do ar (`503 provider_unavailable`) → estado de erro com "Tentar novamente" e o chat segue com o padrão.

---

### F7.5 — Cotas e limites (≈ 1 dia)

**Objetivo:** o usuário sempre sabe quanto pode usar e quando renova.

**Tarefas**
1. `useUsage()` (`GET /usage`) + `usage-sync.ts`: `setQueryData` a partir de (a) cabeçalhos `X-RateLimit-*` no início do stream, (b) `usage` do `done`/JSON, (c) token de convidado (`usage` inicial).
2. `UsageMeter` (componente compacto, tokens atuais): barra "restantes hoje" (guest/usuário), "por minuto" e "renova às HH:mm" (UTC→local via `Intl`). Admin: apenas "limite por minuto" (campos diários vêm `null`).
   - Locais: Composer (linha fina), `ContextPanel` (cartão), Ajustes › Conta.
3. Bloqueios:
   - `rate_limited` (429): desabilita o composer pelo `Retry-After`, contagem regressiva, reabilita sozinho.
   - `guest_daily_limit_reached` / `ip_daily_limit_reached` / `user_daily_limit_reached`: banner fixo no composer com `resets_at` local e CTA "Entrar" (para guest). Mensagem distinta para IP ("cota deste local/rede").
4. Limites de contexto por papel (`limits.ts`): padrões `guest/user = 20 msgs × 2000 caracteres`, `admin = 100 × 8000`; sobrescrevíveis por `VITE_LIMIT_*`. Em `422` de contexto, parsear `"no máximo N ..."` de `errors[].reason` e **ajustar o limite em memória** (auto-correção) antes de oferecer reenvio.

**Aceite**
- Após cada resposta o contador cai sem chamada extra a `/usage`.
- 4ª mensagem em 1 min como guest → composer bloqueado com contagem; libera sozinho.
- Cota diária esgotada → banner com horário local de renovação; admin nunca vê cota diária.

---

### F7.6 — Saúde e status reais (≈ 0,5 dia)

**Tarefas**
1. `useApiHealth()`: `GET {apiOrigin}/health` a cada 30 s (pausa com aba oculta); estados `online | degraded | offline`, `version`, latência (RTT).
2. `useApiReadiness()` sob demanda (`/health/ready`): `degraded` quando `503` ou algum provedor `available:false`.
3. TopBar: o chip "api conectada/modo demo" passa a refletir o estado real (`api online`, `api degradada`, `api fora do ar`); "núcleo online" continua = conectividade do navegador.
4. `ContextPanel`: "SUBSISTEMAS" mostra **dados reais** — Streaming (SSE/JSON), Provedor/modelo, Versão da API, Latência; "Adaptador: Mock local/HTTP remoto" permanece. Remover o item "Monitor — fase 7" de `ROADMAP`.
5. `ConnectionNotifier`: notificar também "API indisponível" / "API restabelecida" (máx. 3 simultâneas, como hoje).
6. Ajustes › Conexão: botão **Testar conexão** (chama `/health`, mostra versão e latência; diagnóstico de CORS).

**Aceite:** derrubar a API → chip muda em ≤ 30 s e uma notificação é emitida; subir de novo → "restabelecida".

---

### F7.7 — Monitor (público + admin) (≈ 3 dias)

**Objetivo:** substituir `ModuleView` ("em construção") por um painel real, no mesmo visual de cartões.

**Estrutura** (`features/monitor/MonitorView.tsx`, lazy; abas no estilo dos controles segmentados já existentes):

| Aba | Quem vê | Fonte | Conteúdo |
|---|---|---|---|
| **Visão geral** | todos | `/health`, `/health/ready`, `/usage` | Versão, estado, provedores (disponível/indisponível), banco, **seu uso**. Não-admin vê convite "Entre como administrador para estatísticas". |
| **Estatísticas** | admin | `/admin/stats` | Requisições de chat, guests distintos, barradas por limite, erros de provedor, tempo médio de resposta, "desde" (início da contagem). Mini-gráfico (SVG leve) com histórico de *polling* em memória (60 pontos). Aviso: "contadores zeram ao reiniciar a API (RN-12)". |
| **Provedores** | admin | `/admin/ai/status` | Linha por provedor: rótulo, modelo padrão, disponibilidade, `checked_at`, código de erro traduzido. Chaves nunca aparecem. |
| **Guests** | admin | `/admin/guests` + `/admin/usage/reset` | Tabela de `gid` (copiável), IP, uso/limite (barra), última atividade (relativa) + ação **Zerar cota**; tabela de uso por IP + **Zerar IP**. `404 not_found` ao zerar → aviso informativo ("sem cota ativa"). |
| **Banco** | admin | `/admin/db/status`, `/health/db` | Caminho, tamanho, WAL, versão de migração, totais de usuários e de teste, p95 de leitura/escrita (ms). `503 database_unavailable` → cartão de erro (a API segue com login de admin por configuração — RN-19). |
| **Usuários** | admin | F7.8 | Ver F7.8. |

**Comportamento**
- `refetchInterval`: 10 s (estatísticas/guests), 30 s (provedores/banco), **pausa quando a aba está oculta**.
- Não-admin que force a rota recebe `403 forbidden` → tela de "Acesso restrito" com botão **Entrar**.
- Estados padronizados já existentes: carregando, vazio, erro com "Tentar novamente".

**Aceite**
- Como visitante, a aba Visão geral mostra uso próprio e saúde; abas de admin não aparecem.
- Como admin, números batem com `curl /admin/stats`; zerar cota de um `gid` reflete na próxima atualização.

---

### F7.8 — Gestão de usuários de teste (admin) (≈ 2,5 dias) — *exige ajuste A1 na API*

**Objetivo:** CRUD completo, com a regra de que **senha só aparece uma vez**.

**Lista** (`GET /admin/users`, `useInfiniteQuery` com `next_cursor`, `limit` 50, máx. 100)
- Filtros: `role`, `is_test`, `is_active` (chips).
- Colunas: usuário (`username_display`), e-mail, estado (ativo · inativo · expirado), cota diária, limite/min, expira em, último login, ações. No mobile, cartões empilhados.
- Admin: linha com ícone de cadeado ("protegido"), **sem** ações destrutivas (a API devolve `409 admin_protected`; a UI nem oferece).

**Ações**
| Ação | Chamada | Detalhes de UX |
|---|---|---|
| Novo | `POST /admin/users` | `username` (3–64, `[a-zA-Z0-9._-]`), e-mail opcional, senha opcional (mín. 8; vazio ⇒ gerada), cota, limite/min, expiração (`datetime-local` → UTC `Z`). `409 username_conflict` → erro no campo. `403 test_users_disabled` → aviso global. |
| Lote | `POST /admin/users/bulk` | `prefix`, `count` (1–1000), cota/limite/expiração. Resultado: tabela de credenciais + **Baixar CSV** (gerado no cliente) + **Copiar tudo**. Aviso persistente: "senhas exibidas uma única vez". |
| Editar | `PATCH /admin/users/{id}` | Só envia campos alterados. Ativar/desativar rápido na linha. Não permite alterar papel/proteção. |
| Redefinir senha | `POST /admin/users/{id}/reset-password` | Corpo opcional (`{}` ou vazio ⇒ gera). Exibe a nova senha uma vez. Invalida o token do usuário na próxima requisição (RF-USR-14). |
| Excluir | `DELETE /admin/users/{id}` | Confirmação com o username digitado. `409 user_not_deletable`/`admin_protected` tratados. |
| Limpar expirados | `POST /admin/users/cleanup` | Confirmação; mostra `removed`. |
| Zerar cota | `POST /admin/usage/reset` (`scope: 'uid'`) | `404` ⇒ "usuário sem cota ativa". |

**Cuidados com credenciais**
- Senhas ficam **apenas** no estado local do diálogo (nunca em cache do Query, `localStorage`, logs ou URL). Usar `mutation.reset()` ao fechar e `gcTime: 0`.
- Botão "Copiar" por senha; campo mascarado com alternância de visibilidade.

**Aceite**
- Criar → editar → desativar → redefinir senha → excluir, tudo pela UI contra a API real (com A1 aplicado).
- Lote de 20 gera CSV com 20 linhas; reabrir a tela **não** mostra mais as senhas.
- Admin aparece protegido e sem ações.

---

### F7.9 — Memória e perfil como contexto

**Implementado.** A memória continua no IndexedDB do navegador, com opção por item
“usar nesta IA”. `personalization.ts` ordena por relevância e recência e aplica
limites; o cliente envia `display_name` e as memórias selecionadas no campo
`personalization`. A API valida os limites e monta um bloco de sistema próprio,
antes das mensagens de conversa. Nenhuma mensagem `system` arbitrária do cliente
é necessária. Guest também pode usar personalização.

---

### F7.10 — Modo Clássico conectado

**Implementado.** O modo clássico usa as mesmas sessões/chat, voz, ajustes e
memórias que o HUD. Busca cobre conversas e memórias locais; monitor e indicadores
consultam API e stores. O scan preserva o overlay animado e mostra resultados das
consultas reais de saúde, catálogo e cota. O painel de gestos preserva a prévia
animada e executa atalhos de navegação; informa que não há reconhecimento por
câmera. Playwright cobre navegação, overlays e envio de mensagem.

### F7.11 — Integrações e Sobre — implementado no Monitor

A seção **Monitor › IA e Chaves** reúne o gerenciamento BYOK. Uma carta visual abre origem e versão da API, links para `/docs`, `/redoc` e `/openapi.json`, além de exemplos copiáveis para OpenAI SDK, Claude Code/Anthropic e Ollama. A carta informa que as chaves de compatibilidade vêm do administrador via `COMPAT_API_KEYS`; a interface não pede nem armazena esses segredos. Essas opções não aparecem mais em Ajustes.

---

### F7.12 — Testes, acessibilidade, performance e documentação

**Em andamento.** Verificações executadas nesta implementação: 74 testes Vitest,
7 cenários Playwright do modo clássico, typecheck e build da Web; contrato
OpenAPI e Ruff na API. Pendências para o aceite final: suite API completa sem
ResourceWarning/falhas, lint da Web (ESLint 10 falha ao integrar com o parser
instalado: `scopeManager.addGlobals is not a function`), auditoria completa de
axe/Lighthouse, teste com provedor real ou sandbox e fechamento do checklist de
release. Não marcar a F7 completa antes dessas ações.

---

## 6. Especificações técnicas

### 6.1 URLs: base da API e origem

```ts
// src/api/config.ts
export function apiBase(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '');            // '/api/v1' | 'https://api.x.com/api/v1'
}

export function apiOrigin(apiUrl: string): string {
  return apiBase(apiUrl).replace(/\/api\/v1$/, '');    // ''      | 'https://api.x.com'
}

// Rotas nativas:  `${apiBase}/auth/login`, `${apiBase}/chat`, ...
// Rotas de raiz:  `${apiOrigin}/health`, `${apiOrigin}/health/ready`, `${apiOrigin}/docs`
```

Validação em Ajustes: aviso (não erro) quando a URL não termina em `/api/v1`.

### 6.2 Parser SSE do chat nativo

**Formato real emitido pela API** (`app/core/sse.py`, `chat_stream.py`):

```
data: {"content":"SSE é "}                      ← trecho (sem "event:")

: ping                                          ← heartbeat (comentário)

data: {"content":"","tool_calls":[{"id":"…","name":"…","arguments":{…}}]}

event: done
data: {"status":"complete","finish_reason":"stop","model_id":"ollama/llama3.1",
       "provider_usage":{"prompt_tokens":42,"completion_tokens":128},
       "usage":{"daily_limit":10,"daily_remaining":6,"per_minute_limit":3,
                "per_minute_remaining":2,"resets_at":"2026-10-29T00:00:00Z"}}

event: error                                    ← só após o fluxo ter começado
data: {"code":"ai_provider_timeout","detail":"…","request_id":"…"}
```

**Regras do parser**

| Regra | Detalhe |
|---|---|
| Quadros | separados por linha em branco (`\r?\n\r?\n`); manter o resto no *buffer* |
| UTF-8 | `TextDecoder` com `{ stream: true }` (caractere multibyte pode quebrar entre *chunks*) |
| Comentários | linhas iniciadas por `:` são ignoradas, mas **reiniciam o *watchdog*** |
| Evento padrão | sem `event:` ⇒ trecho: `content` → evento `token` (se não vazio); `tool_calls` → evento `tool_calls` |
| `done` | encerra a leitura, cancela o `reader` |
| `error` | encerra a leitura; carrega `code`, `detail`, `request_id` |
| Fim sem `done`/`error` | lançar `StreamInterruptedError` (⇒ mensagem `error`, texto parcial preservado) |
| *Watchdog* | 75 s sem nenhum byte ⇒ abortar com `StreamInterruptedError` |
| Desconhecido | eventos nomeados desconhecidos são ignorados (compatibilidade futura) |
| Remover | tratamento de `[DONE]`, `event: token`, `event: meta` (não existem nesta API) |

```ts
// src/api/sse.ts (esboço)
export async function* readChatStream(
  body: ReadableStream<Uint8Array>,
  { idleMs = 75_000 }: { idleMs?: number } = {},
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await readWithIdleTimeout(reader, idleMs);
      if (done) throw new StreamInterruptedError();
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
```

### 6.3 `fitContext()` — montar o contexto dentro dos limites do papel

**Por que existe:** a API valida `messages` por papel (`app/core/chat.py::limits_for`). Para `guest` **e** `user` vale `GUEST_MAX_MESSAGES_PER_REQUEST=20` e `GUEST_MAX_MESSAGE_CHARS=2000`; só o `admin` tem `100 × 8000`. Uma resposta do assistente de ~1024 tokens passa dos 2000 caracteres e **invalidaria a requisição seguinte**.

```ts
// src/features/chat/context.ts
export interface ContextLimits { maxMessages: number; maxChars: number }
export interface FitResult {
  messages: { role: 'user' | 'assistant'; content: string }[];
  droppedMessages: number;     // mensagens antigas que ficaram de fora
  truncatedMessages: number;   // mensagens antigas cortadas em maxChars
}

export function fitContext(history: ChatMessage[], limits: ContextLimits): FitResult;
```

**Algoritmo**
1. Manter só `user`/`assistant` com conteúdo não vazio (`trim()`); **excluir** `status: 'error'` e o *placeholder* do assistente em `streaming`. Mensagens `stopped` (parciais) **entram**.
2. Colapsar mensagens consecutivas do mesmo papel (une com `\n\n`) — alguns provedores rejeitam papéis repetidos e a pergunta anterior sem resposta (por erro) fica órfã.
3. A **última** mensagem é sempre `user` e **nunca** é truncada: se passar de `maxChars`, lançar `ContextTooLargeError` (o composer já bloqueia antes, via contador).
4. Mensagens antigas acima de `maxChars` são cortadas em `maxChars − 1` + `…`.
5. Se `length > maxMessages`: descartar as mais antigas; em seguida remover `assistant` iniciais para a lista começar em `user`.
6. Retornar contagens para um aviso discreto: "Contexto reduzido: N mensagens antigas não foram enviadas" (nota mono 10px, mesmo estilo dos avisos atuais). O **histórico exibido não é alterado**.

**Origem dos limites:** `limits.ts` (padrões por papel) → `VITE_LIMIT_*` → correção automática ao ler `errors[].reason` de um `422` (`"no máximo N mensagens"` / `"no máximo N caracteres"`). Sugestão R1 (seção 4.2) elimina a adivinhação.

### 6.4 Autenticação e `401`

```
ensureToken()
 ├─ token válido?                     → devolve
 ├─ guest salvo e válido?             → devolve
 └─ POST /auth/guest (single-flight)  → salva em localStorage, semeia ['usage']

request() recebe 401
 ├─ role = guest   → handleUnauthorized(): descarta token, ensureToken(), repete 1x
 │                   (no chat: só repete se nenhum token foi entregue)
 └─ role = user/admin → status='expired'; abre LoginDialog; preserva rascunho e histórico
```

Códigos: `invalid_token`, `token_expired`. `WWW-Authenticate: Bearer` acompanha a resposta (a UI não precisa dele).

### 6.5 Ciclo de uma mensagem (fluxo completo)

1. Usuário envia → `use-chat.sendMessage` (valida tamanho, rede, cota local).
2. `HttpChatAdapter.streamReply`:
   a. grava a mensagem `user` no repositório local;
   b. `fitContext(history, limits)`;
   c. corpo: `{ messages, stream, model? }` (**sem** `model` se "Automático"; **sem** `tools` por padrão);
   d. `ensureToken()` → `POST /chat` com `X-Request-ID`.
3. Resposta HTTP:
   - `200` + `text/event-stream` → emite `meta` (cabeçalhos de cota + `X-Request-ID`) → `token`* → `done`.
   - `200` + `application/json` → emite `meta` → um `token` → `done`.
   - `4xx/5xx` → `ApiError` (nenhuma cota consumida em `401/403/422`; `429`/`5xx` conforme Apêndice A).
4. `use-chat` atualiza a mensagem do assistente a cada `token`; no `done`: `status: 'done'`, grava `meta` (modelo, tokens, `finish_reason`), `setQueryData(['usage'])`.
5. Falha **antes** do 1º token: cota devolvida pelo servidor ⇒ a UI informa e **refaz** `GET /usage`.
6. Persistência local ao fim (e também em `stopped`/`error`, para não perder o texto parcial).

### 6.6 Chaves do TanStack Query

| Chave | Fonte | `staleTime` | Notas |
|---|---|---|---|
| `['sessions', identity]` | repositório local | 30 s | `identity` entra na chave (D1) |
| `['messages', identity, sessionId]` | repositório local | 30 s | — |
| `['usage', identity]` | `/usage` + cabeçalhos | 15 s | `setQueryData` após cada chat |
| `['models']` | `/models` | 60 s | `refresh=true` via ação manual |
| `['health']` | `/health` | 30 s (poll) | pausa com aba oculta |
| `['readiness']` | `/health/ready` | 30 s | sob demanda |
| `['admin','stats'|'ai'|'guests'|'db']` | `/admin/*` | 10–30 s (poll) | só com `role==='admin'` |
| `['admin','users', filtros]` | `/admin/users` | 0 | `useInfiniteQuery` |

`queryClient.defaults.retry = 1` permanece, **exceto** `401/403/404/409/422/429` (não adianta repetir): `retry: (n, e) => !(e instanceof ApiError && e.status < 500 && e.status !== 408) && n < 1`.

### 6.7 Persistência local e migração

| Dado | Armazenamento | Chave |
|---|---|---|
| Demo (sessões/mensagens) | IndexedDB | `nexa:chat:v1` (inalterada) |
| Real — convidado | IndexedDB | `nexa:chat:v2:guest` |
| Real — admin/usuário | IndexedDB | `nexa:chat:v2:user:<user_id>` |
| Memória | IndexedDB | `nexa:memory:v1` (inalterada) |
| Preferências | `localStorage` | `nexa:settings:v1` (novos campos opcionais, `sanitizeSettings` os trata) |
| Modelo escolhido | `localStorage` | `nexa:model:v1` |
| Token de convidado | `localStorage` | `nexa:auth:guest:v1` |
| Sessão admin/usuário | `sessionStorage` | `nexa:auth:session:v1` |

Campos novos (`Session.modelId`, `ChatMessage.meta`) são **opcionais** ⇒ sem migração destrutiva. Ao sair (logout), perguntar se deseja **apagar o histórico local** daquela identidade.

### 6.8 Formatação

| Dado | Regra |
|---|---|
| `resets_at` / datas | ISO UTC → `Intl.DateTimeFormat('pt-BR', …)` no fuso do navegador (a cota renova **00:00 UTC**, 21:00 em São Paulo) |
| Bytes | `formatBytes()` (KB/MB/GB, `pt-BR`) |
| Janela de contexto | `131072` → `128k` |
| Tokens | separador de milhar `pt-BR` |
| Duração média | `3,42 s` |
| Tempo relativo (guests) | "há 2 min" (`Intl.RelativeTimeFormat`) |

### 6.9 Acessibilidade das novas telas

- Diálogos nativos `<dialog>` com foco preso e `Esc` (padrão já usado).
- Tabelas com `<caption class="sr-only">`, `scope` em cabeçalhos; versão em cartões no mobile.
- Contagens regressivas anunciadas **uma vez** por mudança relevante (início/fim), não a cada segundo (`aria-live="polite"` no contêiner estável, texto atualizado a cada 10 s ou no zero).
- Resultados de ações (criar, excluir, redefinir) por `notify()` (já anunciado).
- Alvos de toque ≥ 44 px, `aria-label` em botões de ícone, contraste AA nos novos chips.
- Não colocar `aria-live` no contêiner que recebe tokens (regra já adotada no plano original).

---

## 7. Diretrizes visuais (tema preservado)

**Princípio:** nenhuma cor, fonte, raio ou espaçamento novos. Tudo reutiliza o que já existe em `src/styles/tokens.css` e nos componentes atuais.

### 7.1 Regras

| Item | Regra |
|---|---|
| Cores | Somente tokens (`primary`, `secondary`, `success`, `warning`, `danger`, `foreground`, `muted`, `surface`, `surface-2`, `border`). Nada de hex novo. |
| Tipografia | `font-display` (títulos), corpo padrão, `font-mono` 10 px *uppercase* com `tracking` para rótulos. Nada abaixo de 10 px. |
| Cartões | `rounded-2xl border border-border bg-surface/50 p-4 sm:p-5` (padrão do `SectionCard`) |
| Chips | `rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]` + tom `success`/`warning`/`danger` (padrão do `StatusChip`) |
| Botão primário | `min-h-11 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:bg-primary/15` |
| Botão destrutivo | mesmo formato do "Restaurar padrões" (`hover:border-danger/30 hover:text-danger`) |
| Campos | `rounded-xl border border-white/10 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/40` |
| Diálogos | `<dialog>` + estilo de `nexa-sheet`; se precisar de variante centralizada, `.nexa-dialog` derivada dos mesmos tokens |
| Animação | respeitar `reducedMotion` (atributo `data-reduced-motion` já existente); nada de novas animações infinitas |
| Gráficos | SVG simples (sparkline) com `stroke` em `currentColor`/`text-primary`; **sem** `recharts` fora do chunk clássico |
| Idioma | PT-BR na UI nova; o modo clássico mantém o inglês original |

### 7.2 Componentes compartilhados a extrair (sem mudança visual)

Hoje definidos dentro de `SettingsView.tsx`/`TopBar.tsx`; extrair para `src/components/hud/` para reuso nas novas telas:

`SectionCard` · `SettingSwitch` · `StatusChip` · `HudDialog` (envolve `<dialog>`) · `HudButton` (variantes primary/ghost/danger) · `HudField` · `HudTable`.

### 7.3 Esboços (estrutura, não pixel-perfect)

**Cabeçalho do chat com seletor de modelo** (substitui os dois chips estáticos)

```
[orbe] Nova conversa                                  [ llama3.1 ▾ ]  [ online ]
       RESPONDENDO · 14:32
```

**Seletor de modelo (`<dialog>`)**

```
┌ MODELOS ─────────────────────────────────────── [↻ atualizar] ┐
│ ◉ Automático (padrão do servidor: ollama/llama3.1)            │
│ ● OLLAMA LOCAL                                      disponível│
│   ○ llama3.1:latest   8.0B · Q4_K_M · 4,6 GB · 128k           │
│        [chat][stream][tools]                                  │
│   ○ qwen2.5:7b        …                                       │
│ ● OPENAI                                          indisponível│
│   (esmaecido)                                                 │
└───────────────────────────────────────────────────────────────┘
```

**Medidor de uso** (linha fina acima do composer)

```
HOJE 7/10 ▰▰▰▰▰▰▰▱▱▱   MINUTO 2/3   RENOVA 21:00        [Entrar para mais]
```

**Monitor**

```
[ Visão geral ][ Estatísticas ][ Provedores ][ Guests ][ Banco ][ Usuários ]
┌ REQUISIÇÕES ┐┌ GUESTS ┐┌ BARRADAS ┐┌ ERROS IA ┐┌ RESP. MÉDIA ┐
│     128     ││   14   ││    7     ││    2     ││   3,42 s    │
└─────────────┘└────────┘└──────────┘└──────────┘└─────────────┘
 sparkline (60 pontos)             desde 28/10 10:00 · zera ao reiniciar a API
```

**Usuários**

```
[ + Novo ] [ Lote ] [ Limpar expirados ]      filtros: [teste][ativo][inativo]
usuário    e-mail      estado   cota/dia  rpm  expira       último login   ações
admin  🔒  —           ativo    —         —    —            há 2 min        —
teste01    a@b.com     ativo    100       10   05/11 14:30  —               ✎ 🔑 ⏻ 🗑
```

---

## 8. Modo Clássico

O clássico é uma **réplica congelada** (decisão 4 do plano original). A integração muda **somente a origem dos dados**; layout, cores, fontes inline, animações e textos em inglês permanecem. Tudo abaixo só ocorre com `demoMode = false`; em demo o comportamento atual é idêntico.

### 8.1 Console de comandos (P1)

| Aspecto | Hoje | Integrado |
|---|---|---|
| Resposta | `AI_RESPONSES` por palavra-chave, `setTimeout` | `POST /chat` real via o mesmo `HttpChatAdapter` |
| Histórico | `initialMessages` em memória | Sessão local dedicada **"Classic console"** no repositório (continuidade com o HUD) |
| Digitação | `TypingText` reinicia a cada mudança de `text` | Para mensagem **em streaming**, renderizar o texto acumulado direto com o cursor `▋` existente (o `TypingText` reiniciaria a cada token); mensagens antigas e do modo demo seguem com `TypingText` |
| Comandos locais | `scan`, `settings`, `apps`, `gesture` abrem overlays | Continuam **locais e não chamam a API** (não gastam cota); demais entradas vão à API |
| Estado da IA | `setAiState` manual | Dirigido pelo streaming: `processing` → `responding` → `idle` |
| Erros | — | `addNotification({ type: 'error', title: 'NEXA Error', message })` (inglês; `429` mostra "retry in Ns" / "limit resets at HH:MM") |
| Ícones Download/Trash (hoje sem ação) | decorativos | Download exporta a conversa (`.txt`); Trash limpa a sessão do console (P2) |

### 8.2 System Monitor (P2)

Mantém `MetricCard`, sparklines e posições. Em modo real, os geradores aleatórios dão lugar a *polling* real (adicionar prop opcional `barPercent` ao `MetricCard`, já que o rótulo/unidade deixam de ser `%`):

| Cartão original | Fonte real | Observação |
|---|---|---|
| CPU | **API LATENCY** — RTT de `/health` (ms) | barra = `min(ms/1000, 1)` |
| MEMORY | **QUOTA** — uso diário (guest/usuário) ou limite/min (admin) | `/usage` |
| NETWORK | **PROVIDERS** — % de provedores disponíveis | `/health/ready` |
| GPU | **ERRORS** — `provider_errors_total / chat_requests_total` | `/admin/stats` (admin); `—` para os demais |
| TEMP | **AVG RESP** — `avg_response_seconds` | `/admin/stats`; `—` para os demais |
| Uptime | `now − stats.since` | `/admin/stats`; `—` para os demais |

### 8.3 Demais painéis

| Painel | Integração | Prio |
|---|---|---|
| MemoryPanel | Listar as memórias **locais reais** (IndexedDB) no lugar do `initialMemories`; selo `synced` vira `LOCAL` | P2 |
| SettingsPanel | Linhas somente leitura: URL da API, versão, identidade, papel | P2 |
| TopBar clássico | Estado da IA real (já vem do contexto) | P1 |
| SearchPanel / ScanningPanel / GesturePanel / AppGrid | **Sem mudança** (não há equivalente na API; permanecem demonstrativos) | — |
| Login | Não há tela de login no clássico; usa a identidade vigente (sessão do HUD ou convidado). Dica no rodapé do console: "Sign in on NEXA HUD for admin features" | P2 |

### 8.4 Critérios de aceite

- Demo: captura 1440×900 idêntica à atual (comparação visual com tolerância).
- Real: enviar "hello" no console transmite resposta da API; "scan" abre o overlay **sem** chamada de rede.
- Sem novas CSS/variáveis; crescimento do chunk clássico < 10 KB gzip; `grep -ri nexus src/` continua vazio.

---

## 9. Estratégia de testes

### 9.1 Unitários (Vitest)

| Arquivo | Casos |
|---|---|
| `tests/api/sse.test.ts` | quadros fragmentados em qualquer byte; CRLF; heartbeat; `content` + `tool_calls`; `done`; `error`; fim sem `done` ⇒ `StreamInterruptedError`; multibyte quebrado; *watchdog*; evento desconhecido ignorado |
| `tests/api/client.test.ts` | Problem Details completo; corpo HTML (502); `Retry-After`; `204`; timeout; *abort*; `X-Request-ID` enviado/lido; `Content-Type` só com corpo |
| `tests/api/http-chat-adapter.test.ts` | **reescrito**: corpo enviado (`messages`, `stream`, `model` omitido em Automático), JSON e SSE, erros por `code`, repetição após `401` de convidado, persistência local |
| `tests/features/fit-context.test.ts` | truncamento, descarte, colapso de papéis, exclusão de `error`/placeholder, última mensagem intacta, `ContextTooLargeError` |
| `tests/api/auth.test.ts` | *single-flight* do convidado; expiração; login; logout; `handleUnauthorized` |
| `tests/api/token-storage.test.ts` | convidado em `localStorage`, admin em `sessionStorage`, modo `memory` |
| `tests/api/config.test.ts` | `apiBase`/`apiOrigin` |
| `tests/api/usage-sync.test.ts` | cabeçalhos `X-RateLimit-*`, `usage` do `done` |
| `tests/api/errors.test.ts` | todos os `code` do catálogo têm mensagem PT-BR |
| `tests/features/local-repository.test.ts` | *namespaces* isolados por identidade; persistência |
| `tests/features/users-forms.test.ts` | validação espelhando o servidor (username, senha ≥ 8, limites) |

### 9.2 Componente (Testing Library)

`LoginDialog` (lockout), `ModelPicker` (selectable, indisponível, Automático), `UsageMeter`, `Composer` (contador, bloqueios), `MessageBubble` (`length`/`timeout`/`tool_calls`), `UsersTable` (admin protegido), `OneTimeSecrets` (senha some ao fechar), `MonitorView` (visão pública × admin).

### 9.3 Contrato contra o OpenAPI

- `tests/contract/openapi.test.ts`: carrega a cópia de `openapi.json` e verifica que **cada** rota/método usado pelo cliente existe, que os campos obrigatórios do corpo enviado constam no *schema* e que os campos lidos existem na resposta.
- CI: `npm run api:types:check` falha se o `openapi.d.ts` versionado divergir do snapshot.
- Quando a API mudar de forma intencional (`UPDATE_OPENAPI=1` no repositório da API), copiar o snapshot e rodar `npm run api:types`.

### 9.4 End-to-end (Playwright)

**Com API simulada** (`page.route`, fixtures de SSE reais) — roda no CI sem backend:

| Fluxo | Verifica |
|---|---|
| Visitante envia e recebe stream | Sem login; 1 `POST /auth/guest`; texto incremental; uso decrementa |
| Parar geração | Conexão abortada; mensagem `stopped` |
| Falha no meio do stream | `event: error` ⇒ texto parcial + retry |
| `429` por minuto | Composer bloqueado com contagem; libera |
| `429` diário | Banner com horário local; CTA Entrar |
| `422 model_not_allowed` | Volta para "Automático" e avisa |
| Login admin → Monitor | Abas de admin visíveis; estatísticas renderizam |
| Usuários CRUD | Criar, editar, desativar, redefinir, excluir; senha some ao fechar |
| Token de admin expira | Login reaberto; rascunho e histórico preservados |
| Offline/online | Notificações e bloqueio de envio (já coberto; manter) |
| Trocar identidade | Histórico do admin não aparece para o convidado |

**Contra a API real (`@live`, job opcional)**: `docker compose` da API com `AI_ENABLED_PROVIDERS=fake`, `ALLOW_TEST_USERS=true` e CORS liberando `http://localhost:4173`; variáveis `LIVE_API_URL`, `LIVE_ADMIN_USER`, `LIVE_ADMIN_PASSWORD`. Cobre: chat stream, catálogo, admin/stats, CRUD de usuário (valida o ajuste A1).

### 9.5 Qualidade e métricas

- `npm run check` (lint + tipos + testes + build) e e2e no CI.
- axe sem violações em: Monitor (todas as abas), Usuários, LoginDialog, ModelPicker, Ajustes (novos cartões).
- Lighthouse ≥ 90 (meta: manter 100) em desktop e mobile.
- Orçamento: chunk inicial **< 300 KB gzip** (hoje ~162 KB); chunk `monitor`/`admin` lazy **< 40 KB gzip**.
- Sem erros de console; sem *overflow* em 360, 390, 768, 1024 e 1440 px.

---

## 10. Segurança e privacidade

| Tema | Medida |
|---|---|
| Chaves | Nenhuma chave de provedor ou `nxa_...` no frontend, no bundle ou em Ajustes. Verificar com `grep` no `dist/` no CI. |
| Tokens | Convidado em `localStorage` (anônimo, baixo privilégio); admin/usuário em `sessionStorage` (ou memória via `VITE_AUTH_STORAGE=memory`). Nunca em URL, logs ou `console`. |
| XSS | Markdown continua sanitizado (`rehype-sanitize`); `detail`/`code` de erros e campos como `username_display`, `email`, `gid`, `ip` renderizados como **texto**, nunca HTML. CSP no deploy. |
| Senhas de usuários de teste | Exibidas uma única vez, só em estado local do diálogo; sem cache do Query; `Cache-Control: no-store` já é enviado pelo servidor. |
| Conteúdo do chat | Fica no navegador do usuário (IndexedDB); a API não persiste conteúdo (RF-CHAT-06). Aviso em Ajustes: "O histórico fica só neste navegador". Opção "Apagar histórico local". |
| Isolamento | Histórico segmentado por identidade (D1); logout oferece apagar. |
| Voz | Aviso existente sobre Web Speech do Chrome permanece. |
| CORS/HTTPS | Produção apenas por HTTPS; `CORS_ORIGINS` restrito à origem da UI. |
| Enumeração de usuários | Mensagem de login genérica (a API já iguala tempo e resposta). |
| Rastreabilidade | `X-Request-ID` exibido/copiável nos erros, sem dados pessoais. |
| Controle de acesso | Abas de admin só renderizam com `role==='admin'`; a API é a autoridade (`403`). |

---

## 11. Configuração, ambiente e deploy

### 11.1 Variáveis do frontend

```env
# .env.example (atualizado)
VITE_API_URL=/api/v1                  # dev: proxy; prod: https://api.exemplo.com/api/v1
VITE_DEMO_MODE=true                   # false para usar a API real
VITE_APP_NAME=NEXA
VITE_MOCK_TOKEN_DELAY=22
VITE_API_PROXY=http://localhost:8000  # antes :3001
VITE_AUTH_STORAGE=session             # session | memory (admin/usuário)
VITE_OLLAMA_URL=/ollama               # modo OFFLINE same-origin
VITE_OLLAMA_PROXY=http://127.0.0.1:11434
VITE_OLLAMA_NUM_CTX=4096

# Opcionais: limites padrão do papel (sobrescritos pela correção automática)
VITE_LIMIT_GUEST_MESSAGES=20
VITE_LIMIT_GUEST_CHARS=2000
VITE_LIMIT_ADMIN_MESSAGES=100
VITE_LIMIT_ADMIN_CHARS=8000
```

### 11.2 Execução local

```bash
# 1) API (repositório da API)
make setup && cp .env.example .env   # ajustar ADMIN_PASSWORD_HASH e JWT_SECRET (e ver seção 4.3)
make run                             # http://localhost:8000

# 2) UI
cp .env.example .env                 # VITE_DEMO_MODE=false
npm install && npm run dev           # http://localhost:5173 (proxy /api, /health e /ollama)
# Para acesso de outro dispositivo na rede: npm run dev -- --host
```

### 11.3 Produção

| Tema | Orientação |
|---|---|
| Origens | UI e API em origens diferentes ⇒ `CORS_ORIGINS` da API = origem da UI; `VITE_API_URL` = URL completa. |
| Ollama local | O proxy `/ollama` é para desenvolvimento/preview, aponta ao Ollama no mesmo computador do Vite e remove `Origin`. Em deploy estático, configure proxy reverso próprio ou CORS no Ollama; não use `localhost` do lado do navegador remoto. |
| SSE e proxies | **Evitar** *rewrites* de CDN/hosting estático para a API (podem bufferizar SSE ou cortar conexões longas). Preferir chamada direta *cross-origin* (CORS) ou proxy reverso próprio com `proxy_buffering off` (a API já envia `X-Accel-Buffering: no`). Testar com túnel real antes de publicar. |
| CSP | `connect-src 'self' https://api.exemplo.com`; `img-src 'self' data:`; sem `unsafe-eval`. |
| `vercel.json` / `_redirects` | Mantêm só o *fallback* de SPA (já configurado). |
| Cabeçalhos expostos | A API já expõe `X-RateLimit-*`, `Retry-After`, `X-Request-ID` e `Content-Type` por CORS (CA-19). |
| Uma instância | Os contadores de cota são em memória (1 processo) ou Redis; a UI não depende disso, mas cotas "zeram" quando a API reinicia (RN-12). |

---

## 12. Riscos e mitigação

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R1 | CORS sem `PATCH`/`DELETE` | Gestão de usuários falha em produção | Ajuste A1 na API; teste `@live` cross-origin |
| R2 | `422` por tamanho de contexto (assistente > 2000 caracteres) | Conversas de visitante quebram na 2ª–3ª pergunta | `fitContext()` + correção automática de limites; sugestão R1 da API |
| R3 | **Decisão a confirmar:** token de convidado em `localStorage` e de admin em `sessionStorage` (o plano original recomendava "memória/cookie httpOnly") | A API devolve o token no corpo JSON e não usa cookies (`allow_credentials=False`), então cookie `httpOnly` **não é possível** sem mudar a API. Memória pura obriga login a cada *reload* | Configuração `VITE_AUTH_STORAGE`; CSP rígida; markdown sanitizado; tokens de curta duração (60 min admin) |
| R4 | Limite de emissão de convidado por IP (10/h) | Ambientes atrás de NAT (escritório) bloqueiam novos visitantes | Persistir o token; reaproveitar até expirar; mensagem clara em `guest_token_limit_reached` |
| R5 | Cota por **IP** (30/dia) esgota para todos de uma mesma rede | Visitantes legítimos bloqueados | Mensagem específica (`ip_daily_limit_reached`); incentivo a entrar |
| R6 | SSE *bufferizado* por proxy/CDN | Texto chega em bloco, parece travado | Seção 11.3; teste com túnel real; *watchdog* e modo JSON como alternativa nas Ajustes |
| R7 | Perda do histórico (dados só no navegador) | Usuário troca de dispositivo/limpa dados | Aviso explícito; exportar/importar JSON (P2) |
| R8 | Mudança futura do contrato da API | Quebra silenciosa | Tipos gerados do OpenAPI + teste de contrato + `api:types:check` no CI |
| R9 | Contadores/estatísticas zeram ao reiniciar a API | Monitor "parece" ter perdido dados | Legenda "desde …" e aviso de volatilidade (RN-12) |
| R10 | Semântica do `tool_use` | UI não consegue fechar o laço de ferramentas (última mensagem precisa ser `user`) | Exibição somente leitura; ver seção 13 |
| R11 | Orçamento de *bundle* | Monitor/usuários inflarem o chunk inicial | `React.lazy`, SVG próprio, sem `recharts` fora do clássico |
| R12 | Regressão visual | Tema alterado sem querer | Extração dos componentes sem mudar classes; captura visual (demo) antes/depois; revisão de PR com checklist da seção 7 |

---

## 13. O que a API não permite (limites conhecidos)

Itens **não implementáveis** (ou só parcialmente) sem alterar a API, para alinhar expectativas:

| Tema | Limitação | Tratamento na UI |
|---|---|---|
| Histórico no servidor / sincronização entre dispositivos | Fora do escopo da API (RP-02, RD-14) | Histórico local; exportar/importar (P2) |
| Prompt de sistema e parâmetros de geração | Não aceitos do cliente (RF-CHAT-09); `system` só com `ALLOW_CLIENT_SYSTEM_MESSAGES` e nunca para guest (RN-06) | Sem controles de temperatura/system; F7.9 é opcional e se desativa sozinha |
| Ciclo completo de *tools* | O schema aceita `tools`/`tool_calls` e mensagens `tool`, mas **a última mensagem deve ser `user`** (`RF-CHAT-04`), impedindo devolver o resultado da ferramenta como última mensagem | Mostrar `tool_calls` somente leitura; não executar ferramentas no navegador |
| Refresh de token / revogação | Inexistentes (RF-AUT-09) | Reautenticação; sessão curta |
| `GET /auth/me` | Inexistente | Identidade vem do login/guest (sugestão R2) |
| Memória, busca, ajustes no servidor | Inexistentes | Permanecem locais |
| Telemetria em tempo real (WebSocket) | Inexistente | *Polling* de `/admin/stats` e `/health*` |
| Gestão de API keys de compatibilidade | Só por variável de ambiente (RP-12) | Apenas documentação de uso |
| Envio de arquivos/imagens (`vision`) | A API expõe a capacidade no catálogo, mas o schema de chat nativo só aceita texto em `content` | Mostrar o selo `vision`; sem *upload* |
| Cotas persistentes | Voláteis (RN-12) | Informar na UI |

---

## 14. Definição de pronto

**Funcional**
- [ ] Visitante conversa em streaming sem login; histórico sobrevive ao *reload*.
- [ ] Login/logout de admin e de usuário de teste; expiração tratada sem perder rascunho.
- [ ] Seletor de modelo reflete `GET /models`; "Automático" omite `model`.
- [ ] Cotas e limites visíveis; bloqueios com contagem/horário corretos.
- [ ] `length`/`timeout`/`tool_use` tratados; "Continuar" funciona.
- [ ] Monitor com dados reais (visão pública e de admin).
- [ ] CRUD completo de usuários de teste, lote com CSV, redefinição, limpeza e zerar cota.
- [ ] Chips da TopBar e painel de contexto com dados reais.
- [ ] Modo clássico: console real e monitor real, sem alteração visual.
- [ ] Modo demo continua funcionando como hoje.

**Qualidade**
- [ ] `npm run check` verde; e2e (simulado) verde; e2e `@live` verde contra a API com `fake`.
- [ ] Teste de contrato OpenAPI e `api:types:check` no CI.
- [ ] axe sem violações nas telas novas; Lighthouse ≥ 90; alvos ≥ 44 px.
- [ ] Chunk inicial < 300 KB gzip; sem chaves no `dist/`.
- [ ] Zero ocorrências de "NEXUS"; PT-BR em toda a UI nova (exceto clássico).

**Documentação**
- [ ] README e `docs/PLANO_DE_IMPLEMENTACAO.md` atualizados (fase 7 concluída; remoção da frase sobre histórico no backend).
- [ ] `docs/INTEGRACAO_API.md` com execução local, variáveis e solução de problemas (CORS, SSE bufferizado, proxy).
- [ ] Ajustes da API (A1/A2) registrados no repositório da API.

---

## Apêndice A — Catálogo de erros → mensagens PT-BR

Todo erro nativo chega como `application/problem+json` com `code`. A UI deve usar o **`code`** (não o `title`) para decidir mensagem e ação. `request_id` aparece em "Detalhes" (copiável).

| `code` | HTTP | Mensagem na UI | Ação |
|---|---|---|---|
| `bad_request` | 400 | "A requisição está malformada." | Copiar ID; reportar |
| `invalid_credentials` | 401 | "Usuário ou senha inválidos." | Manter diálogo; foco na senha |
| `token_expired` | 401 | "Sua sessão expirou." | Convidado: reemitir e repetir 1×; admin/usuário: abrir login |
| `invalid_token` | 401 | "Sessão inválida." | Idem |
| `forbidden` | 403 | "Você não tem permissão para este recurso." | Tela "Acesso restrito" + Entrar |
| `test_users_disabled` | 403 | "A criação de usuários de teste está desativada no servidor." | Aviso no diálogo |
| `not_found` | 404 | Contexto: "Nada a zerar (sem cota ativa)" · "Usuário não encontrado" | Informativo; refazer a lista |
| `method_not_allowed` | 405 | "Operação não suportada." | Copiar ID |
| `admin_protected` | 409 | "O administrador é protegido e não pode ser alterado." | Sem ação |
| `username_conflict` | 409 | "Usuário ou e-mail já está em uso." | Erro no campo |
| `user_not_deletable` | 409 | "Somente usuários de teste podem ser excluídos." | Sem ação |
| `payload_too_large` | 413 | "A mensagem é grande demais." | Reduzir texto |
| `unsupported_media_type` | 415 | "Erro de comunicação com a API." | Bug do cliente: registrar |
| `validation_error` | 422 | Chat: ajusta limites e oferece reenvio · Formulários: mensagens por campo (`errors[].field/reason`) | Auto-correção / marcar campos |
| `model_not_found` | 422 | "Esse modelo não está mais disponível." | Voltar a "Automático"; atualizar catálogo |
| `model_not_allowed` | 422 | "Esse modelo não é permitido pelo servidor." | Idem |
| `unsupported_capability` | 422 | "Esse modelo não suporta o recurso solicitado." | Trocar recurso/modelo |
| `rate_limited` | 429 | "Muitas mensagens em pouco tempo. Tente de novo em N s." | Contagem regressiva (`Retry-After`) |
| `guest_daily_limit_reached` | 429 | "Você usou todas as mensagens de hoje. Renova às HH:mm." | CTA **Entrar** |
| `user_daily_limit_reached` | 429 | "A cota diária da sua conta foi atingida. Renova às HH:mm." | Aguardar |
| `ip_daily_limit_reached` | 429 | "A cota diária desta rede foi atingida. Renova às HH:mm." | Aguardar / Entrar |
| `guest_token_limit_reached` | 429 | "Muitas sessões de visitante neste local. Tente em N min." | Contagem (`Retry-After`) |
| `login_locked` | 429 | "Muitas tentativas de login. Tente em N min." | Contagem; botão desabilitado |
| `internal_error` | 500 | "Ocorreu um erro inesperado na API." | Tentar de novo; copiar ID |
| `ai_provider_error` | 502 | "O provedor de IA falhou." (+ "Nenhuma mensagem foi debitada." se antes do 1º token) | Tentar de novo |
| `provider_unavailable` | 503 | "O provedor de IA está indisponível." | Tentar de novo / trocar de modelo |
| `database_unavailable` | 503 | "O banco de usuários está indisponível." | Mostrar no Monitor; chat e login de admin seguem (RN-19) |
| `ai_provider_timeout` | 504 | "O provedor demorou demais para responder." | Tentar de novo |
| `network_error` *(cliente)* | — | "Não foi possível falar com a API. Verifique a URL e o CORS." | Testar conexão |
| `stream_interrupted` *(cliente)* | — | "A conexão foi interrompida. O texto recebido foi mantido." | Tentar de novo |

> Em `stream=true`, falhas **antes** do 1º trecho podem chegar como `event: error` (HTTP 200); o tratamento é o mesmo da tabela, usando `code`/`detail`/`request_id` do evento.

---

## Apêndice B — Tipos TypeScript do contrato

```ts
// src/api/types.ts (trechos novos/alterados)

export type Role = 'admin' | 'user' | 'guest';
export type FinishReason = 'stop' | 'length' | 'timeout' | 'tool_use';

export interface UsageInfo {
  daily_limit: number | null;         // null para admin
  daily_remaining: number | null;
  per_minute_limit: number;
  per_minute_remaining: number;
  resets_at: string | null;           // ISO UTC
}

export interface ProviderUsage { prompt_tokens: number | null; completion_tokens: number | null }
export interface ToolCall { id: string; name: string; arguments: Record<string, unknown> }

/** Eventos que a UI consome (independente de SSE ou JSON). */
export type ChatStreamEvent =
  | { type: 'meta'; requestId?: string; usage?: UsageInfo }              // cabeçalhos no início
  | { type: 'token'; value: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | {
      type: 'done';
      finishReason: FinishReason;
      modelId?: string;
      providerUsage?: ProviderUsage;
      usage?: UsageInfo;
    }
  | { type: 'error'; code: string; message: string; requestId?: string };

export interface ChatStreamInput {
  sessionId: string;
  content: string;
  signal: AbortSignal;
  modelId?: string | null;            // null/undefined = Automático
  stream?: boolean;                   // padrão true
}

export interface ChatMessageMeta {
  modelId?: string;
  finishReason?: FinishReason;
  promptTokens?: number | null;
  completionTokens?: number | null;
  requestId?: string;
  toolCalls?: ToolCall[];
  errorCode?: string;
}

export interface ChatMessage {
  id: string; role: MessageRole; content: string;
  createdAt: string; status: MessageStatus;
  meta?: ChatMessageMeta;             // novo, opcional
}

export interface Session {
  id: string; title: string; createdAt: string; updatedAt: string;
  modelId?: string | null;            // novo, opcional
}

// --- Auth ---
export interface TokenResponse {
  access_token: string; token_type: 'bearer'; expires_in: number;
  role: Role; user_id: string | null;
}
export interface GuestTokenResponse extends TokenResponse { role: 'guest'; usage: UsageInfo }

// --- Modelos ---
export interface ModelEntry {
  model_id: string; name: string; size_bytes: number | null; modified_at: string | null;
  family: string | null; parameter_size: string | null; quantization_level: string | null;
  capabilities: ('chat' | 'stream' | 'tools' | 'vision' | 'json_mode')[];
  context_window: number | null; selectable: boolean;
}
export interface ProviderModels {
  provider: string; name: string; available: boolean; default_model: string; models: ModelEntry[];
}
export interface ModelsResponse {
  default_model: string; providers: ProviderModels[];
  models: { model_id: string; provider: string; name: string; selectable: boolean }[];
}

// --- Admin ---
export interface StatsResponse {
  since: string; chat_requests_total: number; guest_distinct: number;
  rate_limited_total: number; provider_errors_total: number; avg_response_seconds: number;
}
export interface UserResponse {
  id: string; username: string; username_display: string; email: string | null;
  role: Role; is_test: boolean; is_protected: boolean; is_active: boolean;
  daily_message_limit: number | null; rate_per_min: number | null;
  created_at: string; updated_at: string; last_login_at: string | null; expires_at: string | null;
}
export interface UserCreateResponse extends UserResponse { password: string }   // exibir uma única vez
export interface UserPage { users: UserResponse[]; next_cursor: string | null }
```

> Estes tipos serão **substituídos/validados** por `src/api/generated/openapi.d.ts` (D3); o bloco acima documenta a forma esperada.

---

## Apêndice C — Árvore de arquivos

```
src/
├── api/
│   ├── client/{http.ts, problem.ts, rate-limit.ts}          [novo]
│   ├── generated/{openapi.d.ts, openapi.snapshot.json}      [novo]
│   ├── adapters/{http.ts [reescrito], mock.ts [ajustado]}
│   ├── storage/{indexed-db.ts, local-chat-repository.ts [novo], types.ts}
│   ├── auth.ts  chat.ts  sse.ts  models.ts  usage.ts
│   ├── admin.ts  users.ts  health.ts  config.ts  errors.ts   [novos]
│   ├── index.ts  types.ts                                    [ajustados]
├── components/hud/{SectionCard,SettingSwitch,StatusChip,HudDialog,HudButton,HudField,HudTable}.tsx   [extraídos]
├── features/
│   ├── auth/{LoginDialog.tsx, AccountCard.tsx, use-auth.ts}                [novo]
│   ├── chat/{ModelPicker, UsageMeter, ToolCallCard}.tsx · context.ts · limits.ts   [novos]
│   │        {use-chat, Composer, MessageBubble, ChatView}.tsx             [ajustados]
│   ├── monitor/{MonitorView, OverviewTab, StatsTab, ProvidersTab, GuestsTab, DatabaseTab, Sparkline}.tsx   [novo, lazy]
│   ├── admin/users/{UsersTab, UserFormDialog, BulkDialog, OneTimeSecrets, use-users}.tsx|ts   [novo, lazy]
│   ├── settings/{SettingsView.tsx [ajustado], IntegrationsCard.tsx, ConnectionTest.tsx}
│   ├── layout/{TopBar, ContextPanel}.tsx [ajustados] · ModuleView.tsx [removido]
│   ├── notifications/ConnectionNotifier.tsx [ajustado]
│   └── classic/{components/CommandConsole.tsx, SystemMonitor.tsx, MemoryPanel.tsx, SettingsPanel.tsx; use-classic-chat.ts [novo]}
├── hooks/use-api-health.ts                                  [novo]
├── lib/{format.ts [+bytes, +relativo, +contexto], …}
├── stores/{auth-store.ts, model-store.ts [novos], settings-store.ts [novos campos]}
tests/{api,features,contract}/…                              [novos e reescritos]
e2e/{chat-real, auth, monitor, users, quota, identity}.spec.ts   [novos]
docs/{INTEGRACAO_API.md [novo], PLANO_DE_IMPLEMENTACAO.md [atualizado]}
```

---

## Apêndice D — Exemplos de requisição/resposta

**Convidado**
```http
POST /api/v1/auth/guest
→ 200 {"access_token":"eyJ…","token_type":"bearer","expires_in":86400,"role":"guest","user_id":null,
       "usage":{"daily_limit":10,"daily_remaining":10,"per_minute_limit":3,"per_minute_remaining":3,
                "resets_at":"2026-10-31T00:00:00Z"}}
```

**Login**
```http
POST /api/v1/auth/login   Content-Type: application/json
{"username":"admin","password":"…"}
→ 200 {"access_token":"eyJ…","token_type":"bearer","expires_in":3600,"role":"admin",
       "user_id":"00000000-0000-0000-0000-000000000001"}
→ 401 application/problem+json {"code":"invalid_credentials","status":401,…,"request_id":"…"}
→ 429 {"code":"login_locked",…}   Retry-After: 900
```

**Chat (corpo enviado)**
```json
{
  "messages": [
    {"role": "user", "content": "Olá!"},
    {"role": "assistant", "content": "Oi! Como posso ajudar?"},
    {"role": "user", "content": "Explique SSE em uma frase."}
  ],
  "stream": true,
  "model": "ollama/llama3.1"
}
```
> `model` é **omitido** quando o usuário está em "Automático". `tools`/`tool_choice` não são enviados por padrão.

**Chat JSON (`stream:false`)**
```json
{
  "message": {"role": "assistant", "content": "SSE envia eventos incrementais.", "tool_calls": []},
  "provider": "ollama", "model": "llama3.1:latest", "model_id": "ollama/llama3.1",
  "finish_reason": "stop",
  "provider_usage": {"prompt_tokens": 42, "completion_tokens": 128},
  "usage": {"daily_limit": 10, "daily_remaining": 9, "per_minute_limit": 3,
            "per_minute_remaining": 2, "resets_at": "2026-10-31T00:00:00Z"}
}
```

**Cota diária esgotada**
```http
429 application/problem+json
Retry-After: 41230
X-RateLimit-Limit: 10   X-RateLimit-Remaining: 0   X-RateLimit-Reset: 1793404800
{"type":"about:blank","title":"Limite diário excedido","status":429,
 "code":"guest_daily_limit_reached","detail":"A cota diária de mensagens foi atingida.",
 "request_id":"b1f4c7e2-…","resets_at":"2026-10-31T00:00:00Z"}
```

**Validação de contexto (422)**
```json
{"code":"validation_error","status":422,"title":"Requisição inválida",
 "detail":"Um ou mais campos são inválidos.","request_id":"…",
 "errors":[{"field":"messages.2.content","reason":"no máximo 2000 caracteres por mensagem"}]}
```

**Criar usuário de teste**
```http
POST /api/v1/admin/users  Authorization: Bearer <admin>
{"username":"teste01","email":"teste01@example.com","daily_message_limit":100,
 "rate_per_min":10,"expires_at":"2026-11-06T14:30:00Z"}
→ 201 Cache-Control: no-store
{"id":"0192f3a4-…","username":"teste01","username_display":"teste01","role":"user",
 "is_test":true,"is_protected":false,"is_active":true,…,"password":"Nxa-gerada-uma-vez"}
```

**Zerar cota**
```http
POST /api/v1/admin/usage/reset
{"scope":"gid","value":"6f1c9a3e-1b2d-4c5f-8a90-0123456789ab"}
→ 204   |   → 404 {"code":"not_found",…}   (alvo sem cota ativa)
```

---

> **Próximo passo sugerido:** aplicar o ajuste A1 na API (1 linha) e iniciar **F7.0 → F7.3** — com isso o chat real já funciona de ponta a ponta e o restante entra em incrementos independentes.
