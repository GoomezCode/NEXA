# NEXA Web — Plano de implementação do modo OFFLINE (Ollama local)

> Repositório alvo: **NEXA Web** (React 19 + TypeScript + Vite + Zustand + TanStack Query).
> Repositório da API: **não muda**. Este plano não altera nenhuma linha da NEXA API.
> Local sugerido para o arquivo: `docs/PLANO_MODO_OFFLINE_OLLAMA.md`.

> **Estado atual (31/10/2026):** o fluxo principal está implementado no código: modo persistido, bloqueio central de chamadas à API, acesso OFFLINE, adaptador Ollama, catálogo filtrado, histórico isolado, contexto local, telas HUD/Clássica, ajustes e monitor. O Vite usa `/ollama` como proxy same-origin em desenvolvimento e preview, remove o cabeçalho `Origin` e encaminha para `127.0.0.1:11434`; isso permite abrir a Web pelo IP da rede sem o navegador falar diretamente com o Ollama. Permanecem pendentes a fachada unificada `useBackend()`, testes automatizados dedicados e validação manual de release com Ollama real. Este plano preserva a especificação e o checklist de fechamento; o [README](../README.md) contém o procedimento de uso atual.

---

## 0. Resumo executivo

### Objetivo

Permitir usar a Web **sem depender da API**. Na tela de acesso (Entrar / Criar conta) haverá um botão **OFFLINE**. Ao clicar, a Web:

- entra direto no app, sem login, sem cadastro e sem token;
- conversa **somente com o Ollama instalado na própria máquina**;
- lista **apenas os modelos locais instalados** (nenhum provedor externo, nenhuma chave de API);
- guarda histórico e memórias no navegador (IndexedDB), como já faz hoje.

### Requisitos do pedido (checklist de aceite)

| # | Requisito | Como será garantido |
|---|-----------|---------------------|
| R1 | Botão **OFFLINE** na página principal (Login **e** Cadastro) | Botão fora do `<form>`, visível nas duas abas (F2) |
| R2 | Funciona com a API ligada **ou** desligada | O botão nunca consulta a API e nunca fica desabilitado por `busy` (F2) |
| R3 | **Não depende da API** | Trava central em `rawFetch` + hooks da API desligados + teste de contrato "zero chamadas à API" (F1, F8) |
| R4 | Usa as IAs locais do Ollama | Cliente próprio do Ollama (`/api/tags`, `/api/chat`) (F3, F5) |
| R5 | **Sem** integração com APIs externas | Sem chaves, sem Ollama Cloud; cliente direto só aceita loopback e o caminho recomendado `/ollama` é same-origin, com destino local configurado pelo Vite (F3, F4) |
| R6 | Aparecem **apenas** as IAs locais instaladas | Catálogo vem de `/api/tags`, filtrado (F4) |

### Decisões do alinhamento (respondidas)

| Pergunta | Resposta | Consequência |
|----------|----------|--------------|
| Onde a Web roda? | **Local**, incluindo acesso por IP da rede com `npm run dev -- --host` | O navegador acessa a origem do Vite; o proxy local conversa com `127.0.0.1:11434` e remove `Origin` |
| Precisa abrir sem internet (PWA)? | **Não**, só a API fica offline | Sem service worker neste plano |
| Modo Clássico? | **Sim**, adaptar | Fase própria (F7) |

### Estimativa

Cerca de **10 a 11 dias úteis** para uma pessoa (indicativo). Ver seção 6.

---

## 1. Diagnóstico do código atual

Pontos da Web que tocam a API e precisam conhecer o modo offline:

| Área | Arquivo(s) | Situação hoje | O que muda |
|------|-----------|---------------|------------|
| Entrada | `features/auth/AuthView.tsx`, `AuthGate.tsx` | Sem `session` mostra login; só `demoMode` ou `session` liberam o app | Novo botão OFFLINE; `AuthGate` libera o app em modo offline e não agenda renovação de token |
| Adaptador de chat | `api/index.ts` | Escolhe `MockChatAdapter` (demo) ou `HttpChatAdapter` (API). Já reinicia adaptador e cache quando o `namespace()` muda | Terceiro adaptador `OllamaChatAdapter`; `namespace()` passa a devolver `offline` |
| Streaming | `api/chat.ts` | Lê **SSE** da API | Novo leitor de **NDJSON** do Ollama (não reaproveita o SSE) |
| HTTP | `api/client/http.ts` (`rawFetch`) | Timeout padrão de 30 s, base = `apiUrl` | Recebe a trava de modo offline. **Não** é usado para falar com o Ollama |
| Modelos | `api/models.ts` (`useModels`) | `GET /models` autenticado | Em offline, consulta o Ollama e devolve o mesmo formato (`ModelsResponse`) |
| Saúde / cotas | `api/health.ts`, `api/usage.ts` | `GET /health`, `GET /usage` | Desligados em offline; saúde do Ollama no lugar |
| Contexto | `features/chat/context.ts` (`fitContext`) | Limites por papel (convidado 20 msgs / 2000 chars; admin 100 / 8000) | Limites por **orçamento de contexto do modelo** em offline |
| Personalização | `features/chat/personalization.ts` | Envia `display_name` e memórias à API, que monta o *system prompt* | O Web monta o *system prompt* localmente (mesmo formato da API) |
| Rede | `use-chat.ts`, `ChatView.tsx`, `ConnectionNotifier.tsx` | Bloqueia envio quando `navigator.onLine === false` | Em offline, o que importa é o Ollama responder, não a internet |
| Monitor | `features/monitor/*` | Saúde da API, cotas, chaves BYOK, carta de integração, admin | Painel próprio do Ollama; o resto é ocultado |
| Clássico | `features/classic/*` (`ClassicApp`, `TopBar`, `ScanningPanel`, `SystemMonitor`, `AICore`) | Usam `useApiHealth`, `useModels`, `useUsage` | Passam a usar uma fachada única (`useBackend`) |
| Já local | `features/memory/api.ts`, `api/storage/indexed-db.ts` | Memórias e histórico no IndexedDB | **Nada a fazer** (já funcionam offline) |

### Glossário (evita confusão no código)

- **Rede offline**: `navigator.onLine === false` (já existe, hook `useOnlineStatus`).
- **Modo OFFLINE**: o produto deste plano (botão OFFLINE, Ollama local).
- No código, o modo é `connectionMode: 'api' | 'offline'`. O hook de rede continua se chamando `useOnlineStatus`.

---

## 2. Decisões de arquitetura

### D1 — Modo de conexão em store próprio

Novo `src/stores/connection-store.ts`, persistido em `localStorage` (`nexa:connection:v1`):

```ts
export type ConnectionMode = 'api' | 'offline';
// estado: { mode: ConnectionMode; setMode(mode): void }
// helper fora do React: isOfflineMode(): boolean
```

Fica separado de `settings-store` porque `settings.reset()` e `sanitizeSettings` não devem apagar a escolha por acidente.

**Precedência:** `offline` > `demoMode` > `api`.

### D2 — Fachada única `useBackend()`

Hoje cada componente decide sozinho entre demo/API (`demoMode ? … : health.data…`). Em vez de espalhar mais um `if` por toda parte, criar `src/api/backend.ts`:

```ts
type BackendKind = 'api' | 'demo' | 'offline';

interface BackendStatus {
  kind: BackendKind;
  health: 'ok' | 'degraded' | 'error' | 'loading' | 'idle';
  healthMessage?: string;      // "Ollama 0.x" ou erro amigável
  models: UseQueryResult<ModelsResponse>;
  usage: UsageInfo | null;     // null em demo e offline (sem cotas)
  label: string;               // "API conectada" | "modo demo" | "ollama local"
  refetch(): void;
}
```

`ClassicApp`, `TopBar` (HUD e Clássico), `ContextPanel`, `ScanningPanel`, `SystemMonitor`, `AICore` e `MonitorView` passam a ler dessa fachada. Os hooks atuais (`useApiHealth`, `useModels`, `useUsage`) continuam existindo e ganham `enabled: ... && !offline`.

### D3 — Trava dura contra chamadas à API

Em `rawFetch` (`api/client/http.ts`): se `isOfflineMode()`, lançar `ApiError(0, 'Modo offline ativo', …, { code: 'offline_mode' })` **antes** de chamar `fetch`. Isso transforma "não depender da API" numa garantia, não numa convenção: se algum hook esquecido tentar chamar a API, ele falha sem sair da máquina. Um teste de contrato (F8) valida isso.

### D4 — Cliente Ollama separado

Pasta nova `src/api/ollama/`, usando `fetch` direto (sem `rawFetch`, sem token, sem timeout de 30 s):

```
src/api/ollama/
  config.ts      # URL base, validação loopback, num_ctx
  client.ts      # version(), tags(), show(), ps(), chat() (stream)
  ndjson.ts      # leitor de NDJSON (puro, testável)
  models.ts      # normaliza para ModelsResponse + filtros
  health.ts      # useOllamaHealth()
  errors.ts      # mensagens amigáveis em PT-BR
```

### D5 — Histórico offline isolado

`namespace()` em `api/index.ts` devolve `'offline'` no modo offline, gerando a chave `nexa:chat:v2:offline` no IndexedDB. Conversas feitas offline **não se misturam** com as de convidado ou de usuário. Como o `useAuthStore.subscribe` já reinicia adaptador, cache e sessão ativa quando o namespace muda, a troca de modo **não exige recarregar a página**.

As **memórias** continuam globais (`nexa:memory:v1`), como hoje, e valem também offline.

### D6 — Escolha de modelo

- IDs no formato `ollama/<nome>` (ex.: `ollama/llama3.1:8b`), igual ao formato canônico que a API já usa. Assim `model-store` e `useModels` continuam funcionando sem mudar de contrato.
- Se o modelo salvo não existir no catálogo, o `useModels` já volta a seleção para `null`.
- **"Automático" em offline** = modelo instalado mais recente (`modified_at` mais novo). A UI mostra o nome escolhido, não só "Automático".
- Sem modelos instalados: estado vazio com instrução (`ollama pull <modelo>`) e envio desabilitado.

### D7 — Contexto por orçamento, não por papel

Não há papéis nem cotas offline. Novo `fitContextToBudget(history, { budgetChars })` em `features/chat/context.ts`:

- orçamento ≈ `num_ctx × 3` caracteres, reservando ~25% para a resposta;
- descarta as mensagens **mais antigas** até caber;
- mantém sempre a última mensagem do usuário inteira (se ela sozinha estourar, erro claro);
- reaproveita a limpeza já feita em `fitContext` (descartar erros/rascunhos, agrupar papéis repetidos).

O `num_ctx` é enviado ao Ollama em `options.num_ctx`, porque o contexto padrão do Ollama varia por versão e histórico longo seria truncado em silêncio sem isso.

### D8 — Sem ferramentas nesta versão

`tool_calls`, visão/imagens e JSON mode **não** entram. O modo offline é conversa em texto com streaming.

---

## 3. Contrato com o Ollama (a validar na F0)

URL padrão do cliente: `/ollama`, encaminhada pelo Vite para `http://127.0.0.1:11434`. O navegador usa a mesma origem da interface, inclusive quando acessada por outro dispositivo da rede local.

| Uso | Chamada | Observação |
|-----|---------|-----------|
| Está no ar? | `GET /api/version` | Também alimenta o chip de status |
| Modelos instalados | `GET /api/tags` | `models[].name`, `size`, `modified_at`, `details.{family,parameter_size,quantization_level}` |
| Detalhes/capacidades | `POST /api/show` `{ "model": "<nome>" }` | Lista de `capabilities` (para excluir *embedding-only*) e tamanho de contexto em `model_info` |
| Modelos carregados | `GET /api/ps` | Opcional, só para o Monitor |
| Conversa | `POST /api/chat` `{ model, messages, stream: true, options: { num_ctx } }` | Resposta em **NDJSON** (uma linha JSON por pedaço) |

### Proxy de desenvolvimento e acesso pela rede

O `vite.config.ts` configura `/ollama` tanto em `server.proxy` quanto em `preview.proxy`. O prefixo é removido antes de encaminhar o caminho (`/ollama/api/tags` → `/api/tags`) e o cabeçalho `Origin` é removido da requisição ao Ollama. O destino padrão é `127.0.0.1:11434`, configurável por `VITE_OLLAMA_PROXY`. Portanto, o Ollama precisa estar rodando no mesmo computador que o processo Vite; não é necessário expor a porta `11434` na rede.

Inicie a Web com `npm run dev -- --host` e configure a URL do Ollama como `/ollama`. Em uma hospedagem estática, o proxy Vite não existe: configure um proxy reverso same-origin ou a política CORS do Ollama para essa origem.

### Formato do stream

```jsonc
{"model":"llama3.1","message":{"role":"assistant","content":"Olá"},"done":false}
{"model":"llama3.1","message":{"role":"assistant","content":""},"done":true,
 "done_reason":"stop","prompt_eval_count":26,"eval_count":42}
// erro no meio do stream:
{"error":"..."}
```

### Mapeamento para o contrato interno (`ChatStreamEvent`)

| Ollama | Evento interno |
|--------|----------------|
| início da resposta | `{ type: 'meta', model: 'ollama/<nome>' }` |
| `message.content` não vazio | `{ type: 'token', value }` |
| `message.thinking` (modelos de raciocínio) | **ignorado** na v1 (não vira token) |
| `done: true` | `{ type: 'done', finishReason: 'stop' \| 'length', modelId, providerUsage: { prompt_tokens: prompt_eval_count, completion_tokens: eval_count } }` |
| `{ "error": … }` ou HTTP 4xx/5xx | `{ type: 'error', code, message }` |
| conexão fechada sem `done` | `StreamInterruptedError` (já existe) |

### Particularidades do chat local

- **Primeiro token pode demorar** (o modelo precisa carregar na memória). Timeout de inatividade do **primeiro** chunk bem maior (sugestão: 5 min) que o dos seguintes (sugestão: 60 s). Enquanto isso, `aiState = 'processing'` com legenda "carregando modelo".
- **Cancelar** = `AbortController.abort()` no `fetch`. O Ollama interrompe a geração quando a conexão fecha.
- **System prompt**: mensagem `system` montada no navegador, no mesmo formato da API (`app/api/chat.py`): instrução de tratar dados do usuário como contexto, "Chame o usuário de {nome}" e bloco `<user_memories>` com `<memory title="…">…</memory>`, com os valores escapados. Reaproveita `buildPersonalization()` (que já roda 100% local).
- **Nome do usuário**: em offline não há conta; usar só `settings.displayName`, ignorando `session.username` de uma sessão antiga.

### Filtros do catálogo (R5 e R6)

Entram na lista somente modelos que:

1. estão **instalados localmente** (excluir entradas que o Ollama marque como remotas/nuvem, ex.: campos `remote_*` ou sufixo `:cloud`);
2. **conversam** (excluir os que só fazem *embedding*, via `capabilities` do `/api/show`; fallback por nome/família quando o campo não existir na versão instalada).

> **Validar na F0** com o Ollama realmente instalado: presença de `capabilities`, forma exata das entradas de nuvem e valor padrão de contexto. Os filtros acima são implementados contra o que a F0 mostrar.

---

## 4. Fases de implementação

Dependências: `F0 → F1 → F2 → F3 → F4 → F5 → (F6 ∥ F7) → F8`.

### F0 — Validação do ambiente (≈ 0,5 dia)

- [ ] Rodar contra o Ollama local e registrar as respostas reais:
  ```bash
  curl http://localhost:11434/api/version
  curl http://localhost:11434/api/tags
  curl http://localhost:11434/api/show -d '{"model":"<um-modelo>"}'
  curl -i -H "Origin: http://localhost:5173" http://localhost:11434/api/tags   # confere CORS
  ```
- [ ] Testar manualmente o proxy em `localhost` e pelo endereço LAN, com Ollama real. O navegador não precisa de `Access-Control-Allow-Origin` para o caminho `/ollama`; esse cabeçalho só é relevante em conexão direta ou hospedagem sem proxy.
- [ ] Anotar campos de `capabilities` e de modelos em nuvem (se houver).
- [ ] Salvar 3 respostas reais como *fixtures* em `tests/fixtures/ollama/`.

**Pronto quando:** fixtures salvas e filtros da seção 3 confirmados ou ajustados.

### F1 — Fundação: modo de conexão, fachada e trava (≈ 1 dia)

- [ ] `stores/connection-store.ts` (persistência, `isOfflineMode()`, reset para testes).
- [ ] `api/client/http.ts`: trava D3 em `rawFetch`.
- [ ] `api/backend.ts`: `useBackend()` (inicialmente com `api` e `demo`; offline completa na F4).
- [ ] Gating nos hooks existentes: `useApiHealth`, `useModels`, `useUsage`, `useProviderKeys` e consultas admin recebem `&& !offline` no `enabled`.
- [ ] `api/index.ts`: `namespace()` devolve `'offline'`; `getChatAdapter()` prepara o ramo offline.
- [x] `.env.example`: `VITE_OLLAMA_URL=/ollama`, destino `VITE_OLLAMA_PROXY=http://127.0.0.1:11434` e `VITE_OLLAMA_NUM_CTX=4096`.

**Pronto quando:** com `mode = 'offline'`, nenhum hook da API dispara requisição (teste unitário com `fetch` espionado).

### F2 — Botão OFFLINE na tela de acesso (≈ 0,5 dia)

`AuthView.tsx`:

- [ ] Novo botão **OFFLINE** no bloco inferior (junto a "Continuar como convidado" e "Usar modo demonstração"), **fora do `<form>`**, portanto visível em **Entrar** e em **Criar conta**, inclusive quando aparece o aviso "cadastro público indisponível".
- [ ] Destaque visual maior que os outros dois (é a saída quando a API caiu), com texto de apoio curto: "Ollama local · sem API".
- [ ] `onClick`: `useConnectionStore.getState().setMode('offline')`. **Sem** `run()`, **sem** `busy`, **sem** chamada de rede, **sem** `window.location.reload()`.
- [ ] Nunca recebe `disabled`.
- [ ] Alvo de toque ≥ 44 px (`min-h-11`), rótulo acessível "Entrar no modo offline com Ollama local".

`AuthGate.tsx`:

- [ ] `if (offline || demoMode || session) return children;`
- [ ] O `useEffect` que agenda renovação/expiração do token **não roda** em offline (evita `ensureGuest()` batendo na API).

Sair do modo (necessário para não prender o usuário):

- [ ] `TopBar` (HUD) e Ajustes: botão **Sair do offline** → `setMode('api')`. Sem sessão, o `AuthGate` volta para a tela de acesso.
- [ ] Texto de `AccountSettings` em offline: "Modo offline — sem conta. Suas conversas ficam neste navegador."

**Pronto quando:** com a API parada e com a API no ar, o botão aparece nas duas abas e abre o app sem nenhuma requisição à API.

### F3 — Cliente Ollama (≈ 1,5 dia)

- [x] `config.ts`: `ollamaBase()` usa `VITE_OLLAMA_URL` (padrão `/ollama`, editável em Ajustes). URLs diretas aceitam somente loopback; a rota do proxy same-origin é aceita para acesso via IP da rede.
- [x] `ndjson.ts`: leitor `readNdjson(body, { firstChunkIdleMs, idleMs })` trata linhas quebradas entre *chunks*, linha vazia, erro e linha final sem quebra.
- [ ] `client.ts`: `getVersion`, `listTags`, `showModel`, `listRunning`, `streamOllamaChat({ model, messages, numCtx, signal })` (gerador assíncrono de `ChatStreamEvent`).
- [ ] `errors.ts`: traduz falhas em mensagens úteis:
  - rede/`TypeError`: "Não consegui falar com o Ollama em `<url>`. Ele está rodando (`ollama serve`)? Se usar conexão direta ou hospedagem sem proxy, configure `OLLAMA_ORIGINS`.";
  - 404 de modelo: "O modelo `<nome>` não está instalado. Rode `ollama pull <nome>`.";
  - erro de memória/execução: repassa a mensagem do Ollama.
- [x] Proxy `/ollama → http://127.0.0.1:11434` em `vite.config.ts` (`server.proxy` e `preview.proxy`), com prefixo removido e cabeçalho `Origin` removido antes do envio ao Ollama.

**Pronto quando:** testes unitários do NDJSON e do cliente passam com as fixtures da F0.

### F4 — Catálogo de modelos locais (≈ 1 dia)

- [ ] `ollama/models.ts`: `/api/tags` (+ `/api/show` por modelo, com cache e concorrência limitada) → `ModelsResponse` com `provider: 'ollama'`, `model_id: 'ollama/<nome>'`, `name`, `family`, `context_window`, `capabilities: ['chat','stream']`, `key_source: 'server'` (campo exigido pelo tipo atual; sem significado offline).
- [ ] Aplicar filtros da seção 3 (somente locais e que conversam).
- [ ] `useModels()`: em offline, `queryFn` do Ollama; `enabled: offline`. `staleTime` curto (ex.: 15 s) e `refetchOnWindowFocus: true`, para que um `ollama pull` recém-feito apareça.
- [ ] Regra do "Automático" (D6) e `default_model`.
- [ ] `ollama/health.ts`: `useOllamaHealth()` consultando `/api/version` a cada ~15 s; entra em `useBackend()`.
- [ ] Componente `ModelPicker` (lista compacta) no cabeçalho do `ChatView`, em offline. O Monitor já lista `models.data.models`, então reaproveita o mesmo hook.
- [ ] Estados: carregando, Ollama fora do ar (com botão "Tentar de novo"), **nenhum modelo instalado** (instrução `ollama pull`), lista normal.

**Pronto quando:** só aparecem modelos instalados e conversáveis; instalar um modelo novo e voltar à aba faz ele aparecer.

### F5 — Chat offline (≈ 2 dias)

- [ ] `api/adapters/ollama.ts`: `OllamaChatAdapter implements ChatAdapter`, igual ao `HttpChatAdapter` na estrutura (`beginExchange` → stream → `finishAssistant` com `done` / `stopped` / `error`), usando `createLocalChatRepository` com `createIndexedDbChatStorage('nexa:chat:v2:offline')`.
- [ ] `getChatAdapter()` retorna `OllamaChatAdapter` em offline.
- [ ] `fitContextToBudget` (D7) + montagem do *system prompt* local (seção 3) em `features/chat/personalization.ts`; `buildPersonalization` ignora `session.username` em offline.
- [ ] Resolver o modelo: `selectedModelId` ou "Automático" (D6). Sem modelo → erro claro, sem requisição.
- [ ] `use-chat.ts`: `sendBlockedByNetwork` deixa de olhar `navigator.onLine` em offline e passa a olhar a saúde do Ollama. Estado `processing` mostra "carregando modelo" até o primeiro token.
- [ ] Retry de mensagem com erro e botão Parar continuam funcionando (mesma lógica do repositório).
- [ ] Sessão "Boas-vindas" semeada igual hoje.

**Pronto quando:** com a API desligada e o `/api/**` bloqueado, conversa com streaming, parar, tentar de novo, recarregar a página e ver o histórico.

### F6 — Telas do HUD (≈ 1,5 dia)

- [ ] **TopBar**: chips `modo offline` e `ollama online/offline` no lugar de `api conectada`, `núcleo online` e do chip de usuário. Botão **Sair do offline**.
- [ ] **ChatView**: chips `nexa-remote` / `online` viram `ollama/<modelo>` / `offline`. O aviso "Sem conexão · envio pausado" aparece só quando o **Ollama** está inacessível.
- [ ] **ConnectionNotifier**: em offline, não avisar queda de internet; avisar queda e retorno do Ollama.
- [ ] **ContextPanel**: provedor "Ollama (local)", modelo, janela de contexto, adaptador "Ollama local"; sem bloco de cotas.
- [ ] **MonitorView**: dividir em `OnlineMonitor` (atual, sem mudanças) e `OllamaMonitor` (novo). Este mostra versão e URL do Ollama, status, lista de modelos (nome, tamanho, parâmetros, quantização), modelos carregados (`/api/ps`) e botão Atualizar. **Ocultos** em offline: cotas, `ProviderKeysPanel`, `ApiLetter`, gestão de usuários e qualquer item admin.
- [ ] **SettingsView**: nova seção "Modo offline (Ollama)" com URL do Ollama, contexto (`num_ctx`), botão **Testar conexão** e o interruptor de entrar/sair do offline. A seção "Conexão" atual (URL da API e demo) fica como está.

### F7 — Modo Clássico (≈ 1,5 dia)

Trocar leituras diretas de API pela fachada `useBackend()`:

- [ ] `ClassicApp.tsx`: `useModels` + `useUsage` → `useBackend()`; rótulo `MODELO` mostra o modelo local.
- [ ] `components/TopBar.tsx`: item `API` vira `OLLAMA` (valor `ONLINE`/`OFFLINE`); sem cotas.
- [ ] `components/ScanningPanel.tsx`: verificações viram *versão do Ollama → lista de modelos → modelo ativo*; sem verificação de cotas.
- [ ] `components/SystemMonitor.tsx`: status e rótulos do Ollama; sem "OFFLINE" ambíguo (hoje esse texto significa "API sem resposta").
- [ ] `components/AICore.tsx`: saúde vem de `useBackend()`.
- [ ] `ClassicContext`/`SearchPanel`/`MemoryPanel`/`SettingsPanel`: só conferir que usam `getChatAdapter()` e memória local (esperado: nada a mudar).

**Pronto quando:** alternar HUD ↔ Clássico (`Alt+M`) em offline mantém a conversa e nenhuma tela exibe "API".

### F8 — Testes, acessibilidade e documentação (≈ 1,5 dia)

Ver seção 5 (testes). Documentação:

- [x] `README.md`: seção "Modo offline (Ollama)" com pré-requisitos, acesso pela rede com `--host`, entrada/saída e limitações.
- [x] `.env.example` atualizado com URL same-origin e destino do proxy.
- [x] Este plano em `docs/` e link no README.
- [x] Troubleshooting para Ollama parado, HTTP 403, catálogo vazio, acesso pela rede e demora do primeiro token.

---

## 5. Estratégia de testes

### Unitários (Vitest)

| Alvo | Casos |
|------|-------|
| `ndjson.ts` | linha dividida entre *chunks*; várias linhas num chunk; linha vazia; `{"error"}` no meio; fim sem `done`; *timeout* do primeiro chunk vs. chunks seguintes |
| Mapeamento de eventos | `content` → token; `thinking` ignorado; `done_reason` `stop`/`length`; contagens → `providerUsage` |
| `ollama/models.ts` | remove modelos de nuvem e *embedding-only*; ordena; IDs `ollama/<nome>`; "Automático" escolhe o mais recente (usar as fixtures da F0) |
| `config.ts` | aceita `localhost`, `127.0.0.1`, `[::1]`; rejeita host externo |
| `fitContextToBudget` | descarta antigas primeiro; preserva a última do usuário; erro se ela sozinha estourar |
| *System prompt* local | nome, memórias, escape de `<`, `>`, `"` e `&` (paridade com a API) |
| `connection-store` | persistência, valor inválido no `localStorage`, reset |

### Componente (Testing Library)

- `AuthView`: botão **OFFLINE** presente na aba Entrar e na aba Criar conta; presente com `VITE_REGISTRATION_ENABLED=false`; presente com `fetch` rejeitando (API fora); clique troca o modo e **não** chama `fetch`.
- `AuthGate`: em offline libera o app sem sessão e sem agendar `ensureGuest`.
- `ModelPicker`: estados carregando, Ollama fora do ar, **sem modelos** e lista normal.
- `useChat` em offline: envio liberado com `navigator.onLine = false` se o Ollama responde; bloqueado quando o Ollama não responde.
- `MonitorView`/Clássico em offline: sem texto "API", sem cotas, sem chaves.

### Contrato "não depende da API" (o teste mais importante)

Com `connection-store = offline`, rodar o fluxo completo (abrir app, listar modelos, enviar mensagem, abrir Monitor, abrir Clássico) com `fetch` espionado e afirmar que **toda** URL chamada começa com a base do Ollama. Qualquer chamada a `apiBase`/`apiOrigin` falha o teste.

### E2E (Playwright)

Sem Ollama real no CI: simular com `page.route` em `**/ollama/api/**` (`/api/tags`, `/api/show`, `/api/version`, `/api/chat` com corpo NDJSON).

1. **API derrubada**: `page.route('**/api/v1/**', r => r.abort())` e `'**/health'` abortado → tela de acesso → OFFLINE → conversa com streaming.
2. **Persistência**: recarregar a página mantém o modo offline e o histórico.
3. **Sair do offline** volta à tela de acesso.
4. **Sem modelos**: `/api/tags` vazio → estado vazio com instrução `ollama pull`.
5. **Ollama fora do ar**: `/api/tags` abortado → mensagem amigável e botão de nova tentativa.
6. **Clássico** em offline (`?ui=classic`).
7. **axe** nas telas novas (botão OFFLINE, ModelPicker, OllamaMonitor, seção de Ajustes).

### Teste manual com Ollama real (checklist de release)

- [ ] `ollama serve` ativo, 1+ modelo instalado: conversa completa, parar no meio, retry.
- [ ] Instalar um modelo novo e ver aparecer sem recarregar.
- [ ] Modelo grande: primeira resposta lenta mostra "carregando modelo" sem erro.
- [ ] Parar o Ollama durante a conversa: erro claro, app não trava.
- [ ] API do NEXA **desligada** durante todo o teste.

### Impacto em testes existentes

Os arquivos `tests/features/chat-offline.test.tsx` e `network-states.test.tsx` usam "offline" no sentido de **rede caída**. Continuam válidos; só conferir que o `connection-store` está em `api` no `setup.ts` (adicionar `resetConnectionForTests()`).

---

## 6. Cronograma e entregas

| Fase | Entrega | Dias |
|------|---------|-----:|
| F0 | Validação do Ollama e fixtures | 0,5 |
| F1 | Store de conexão, fachada, trava | 1 |
| F2 | Botão OFFLINE + `AuthGate` + sair | 0,5 |
| F3 | Cliente Ollama (NDJSON) | 1,5 |
| F4 | Catálogo local + `ModelPicker` + saúde | 1 |
| F5 | Chat offline completo | 2 |
| F6 | HUD (TopBar, Chat, Contexto, Monitor, Ajustes) | 1,5 |
| F7 | Modo Clássico | 1,5 |
| F8 | Testes, a11y, documentação | 1,5 |
| | **Total** | **≈ 11** |

**Marco útil mais cedo:** ao fim da F5 já existe o fluxo completo (botão → modelo → conversa). F6 e F7 completam as telas e podem andar em paralelo.

---

## 7. Segurança e privacidade

- Com o proxy local: o navegador fala com a origem da Web e o processo Vite encaminha as requisições para `127.0.0.1:11434`; o Ollama não precisa ser exposto na rede.
- Sem token, sem senha, sem chaves de provedor em offline. `ProviderKeysPanel` fica oculto.
- URL do Ollama restrita a loopback, para o modo continuar sendo "somente local". Se no futuro quiserem Ollama em outra máquina da rede, isso vira decisão explícita (com aviso).
- O conteúdo das mensagens e memórias entra no *system prompt* já com escape (mesmo cuidado da API contra instruções injetadas via memória).
- Histórico no IndexedDB do navegador (sem criptografia, igual ao comportamento atual). Limpar dados do site apaga tudo.
- Respostas do modelo continuam passando pelo renderizador de markdown **sanitizado** já existente.

---

## 8. Riscos e mitigação

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| CORS do Ollama bloqueia uma conexão direta | Nada funciona | Preferir o proxy `/ollama`, que remove `Origin`; para acesso direto ou hospedagem sem proxy, configurar `OLLAMA_ORIGINS` |
| Web aberta por IP da rede (`--host`) | O browser não deve acessar `localhost:11434`, pois isso apontaria para o dispositivo cliente | Usar `/ollama`; o proxy executa no computador que hospeda o Vite e chega ao Ollama em loopback |
| Ollama parado | App sem resposta | Chip de status, mensagem com `ollama serve`, botão de nova tentativa |
| Nenhum modelo instalado | Chat inútil | Estado vazio com `ollama pull`, envio desabilitado |
| Primeiro token muito lento (carga do modelo) | Parece travado | *Timeout* inicial alto + legenda "carregando modelo" |
| Contexto padrão pequeno trunca o histórico em silêncio | Respostas sem memória da conversa | `options.num_ctx` explícito + `fitContextToBudget` |
| Versão do Ollama sem `capabilities` | Modelo de *embedding* aparece na lista | Fallback por nome/família + validação na F0 |
| Modelos de nuvem aparecendo na lista | Quebra o "somente local" | Filtro + teste com fixture |
| Modelos de raciocínio (campo `thinking`) | Texto extra ou resposta vazia | Ignorar `thinking` na v1; avaliar exibição recolhível depois |
| Confusão entre "rede offline" e "modo OFFLINE" no código | Bugs de condição | Glossário (seção 1), nomes `connectionMode`/`isOfflineMode`, `useOnlineStatus` intacto |
| Componente novo esquece o gating | Chamada à API em offline | Trava D3 + teste de contrato |
| Troca de modo com conversa em andamento | Estado inconsistente | `namespace()` já aborta/limpa; bloquear o botão de sair enquanto `aiState` for `processing`/`responding` (mesma regra do `Alt+M`) |

---

## 9. Definição de pronto

- [ ] Botão **OFFLINE** visível em **Entrar** e **Criar conta**, com API ligada, desligada ou lenta.
- [ ] Com a API parada: entrar, listar modelos, conversar com streaming, parar, tentar de novo, recarregar e manter histórico.
- [ ] A lista mostra **somente** modelos locais instalados que conversam.
- [ ] Teste de contrato prova **zero chamadas** à API em modo offline.
- [ ] HUD e Clássico sem referência a "API", cotas, chaves ou login em offline.
- [ ] Sair do offline leva à tela de acesso e restaura o comportamento anterior.
- [ ] `npm run lint`, `typecheck`, `test`, `build`, `test:e2e` verdes; axe sem violações nas telas novas.
- [ ] README e `.env.example` atualizados.
- [ ] **Nenhuma alteração** no repositório da API.

---

## 10. Fora de escopo (nesta versão)

- Web hospedada (ex.: Vercel) falando com o Ollama do PC: exige proxy reverso acessível pelo cliente ou conexão direta com `OLLAMA_ORIGINS`, além de considerar as políticas de rede local e conteúdo misto do navegador.
- PWA / service worker (a Web precisa ser servida; só a API fica offline).
- Ollama em outra máquina da rede, Ollama Cloud e qualquer provedor externo.
- Ferramentas (`tool_calls`), visão/imagens, JSON mode e exibição do raciocínio (`thinking`).
- Instalar/baixar modelos pela interface (o usuário usa `ollama pull`).
- Sincronizar o histórico offline com a conta/API.

---

## 11. Suposições assumidas (me avise se alguma estiver errada)

1. O histórico offline fica **separado** do de convidado/usuário; as **memórias** continuam compartilhadas.
2. O modo OFFLINE **persiste** após recarregar, até clicar em **Sair do offline**.
3. A URL do Ollama é **editável**, mas só aceita **loopback** (`localhost`/`127.0.0.1`/`[::1]`).
4. "Automático" em offline = **modelo instalado mais recente**.
5. Modelos de **nuvem** e de **embedding** não aparecem na lista.
6. O **modo demonstração** continua existindo; offline tem precedência sobre ele.
7. O seletor de modelo ganha um atalho no cabeçalho do chat (além do Monitor).
