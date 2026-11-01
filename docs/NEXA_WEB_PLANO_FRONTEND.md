# NEXA Web — Plano de implementação do front-end (v2)

> Data: 31/10/2026 · Repositório: `GoomezCode/NEXA` (branch `develop`) · Escopo: **somente a Web** (`NEXA_WEB_UI`). A API só entra onde um item depende dela.
>
> **Base da análise:** li o export completo do repositório (133 arquivos): `src/` inteiro, `tests/`, `e2e/`, configs, CI e todos os documentos em `docs/`. **Não executei o app**, então nenhum número de desempenho aqui é medição minha. Cada achado vem marcado:
> `[código]` visto no código · `[doc]` afirmado nos docs do repositório · `[hipótese]` plausível, mas precisa de medição ou aparelho real.

---

## 1. Resumo executivo

1. **Não troque de framework.** A base já é React 19 + TypeScript + Vite 8 + Tailwind 4 + Zustand + TanStack Query + Motion + Zod, com 77 testes unitários, Playwright (responsivo + axe), Lighthouse CI e orçamento de bundle (148,4 kB gzip medido pelo próprio repositório, limite 200 kB). Reescrever em Next, Svelte ou Vue jogaria isso fora sem resolver as dores, que são de **arquitetura de UI**, não de framework.
2. **As dores reais têm causas localizadas.** Responsividade, lentidão no streaming, overlays e visual vêm de: (a) falta de um design system e de primitivos de UI; (b) três mecanismos diferentes de overlay; (c) o texto em streaming passando pelo cache inteiro do React Query e re-renderizando componentes que só precisam de um número; (d) decisões "só desktop" em pontos específicos (modelo e estado escondidos no celular, teclado virtual sem tratamento do Dock); (e) defaults de configuração que fazem um deploy cair em modo demo.
3. **O plano é uma evolução em 8 fases**, começando por medir (F0) e por correções baratas de alto impacto (F1), e só depois pelo design system, overlays, streaming, layout, efeitos visuais e decomposição das telas grandes.
4. **O que é novo em relação aos planos já em `docs/`:** vários itens do plano "Web Mobile — correção e polimento" (Radix/Vaul/Sonner, `LazyMotion`, `web-vitals`, `useShallow`) **ainda não estão no código** `[código]`. Este plano os retoma, ordena por dor e acrescenta achados novos.

---

## 2. O que já está bom (preservar)

| Área | Evidência `[código]`/`[doc]` |
|---|---|
| Stack moderna e enxuta | `package.json`: React 19, Vite 8, Tailwind 4 (`@tailwindcss/vite`), Zustand 5, TanStack Query 5, Motion, Zod 4 |
| Chunks sob demanda | `AppShell.tsx`: Ajustes, Memória e Monitor com `lazy` + `ChunkLoadBoundary`; Markdown em chunk próprio (`MessageBubble.tsx`) |
| Streaming já agrupado | `use-chat.ts`: tokens agregados em janelas de 33 ms; `MessageBubble` com `memo` e `useDeferredValue`; `content-visibility: auto` nas linhas |
| Fundo animado contido | `BackgroundCanvas.tsx`: ≤ 54 partículas, 20 em compacto, canvas parado em toque, pausa com aba oculta e movimento reduzido |
| Responsividade base | `index.css`: tokens de safe-area, `dvh`, container queries (`.nexa-content-container`), alvos de 44 px em ponteiro grosso, campos de 16 px |
| Acessibilidade | `e2e/a11y.spec.ts` (axe em 320/768/1280), skip-link, `aria-live`, `role=switch` |
| Qualidade em CI | `web-mobile-quality.yml`: matriz responsiva, axe, build, `check:bundle`, Lighthouse CI (LCP ≤ 2,5 s, CLS ≤ 0,1, perf ≥ 0,75) |
| Arquitetura de dados | Adaptadores `http`/`mock`/`ollama` atrás de `ChatAdapter`; modo offline com Ollama por proxy same-origin |

---

## 3. Diagnóstico por dor

### 3.1 Responsividade

| ID | Achado | Onde | Impacto |
|---|---|---|---|
| R1 | Chips de modelo/estado e o **seletor de modelo do Ollama** ficam em `hidden … sm:flex`. No celular não dá para escolher o modelo no modo offline nem ver provedor/estado. `[código]` | `ChatView.tsx` | Funcionalidade inacessível no mobile |
| R2 | Com o teclado virtual aberto o **Dock inferior continua visível**. `useVisualViewport` só ajusta altura/offset; o `--kb-inset` descrito em `GUIA_RESPONSIVIDADE.md` **não existe no código**. Em 320×568 sobra pouco espaço para mensagens. `[código]` + `[hipótese]` | `use-visual-viewport.ts`, `Dock.tsx` | Chat espremido ao digitar |
| R3 | O botão flutuante do painel do núcleo usa `bottom-[calc(var(--safe-bottom)+5.5rem)]` fixo, mas o composer cresce até 168 px. Pode cobrir o campo/enviar. `[hipótese]` | `ContextPanel.tsx` | Toque errado, controle coberto |
| R4 | `[class*='backdrop-blur'] { backdrop-filter: none !important }` abaixo de 768 px remove o vidro de **todos** os painéis por seletor de substring. `[código]` | `index.css` | Perde identidade visual no mobile; hack frágil |
| R5 | Microfone "segure para falar" usa pointer events sem `touch-action: none`, `user-select: none` nem bloqueio de `contextmenu`. Em Android/iOS o press longo pode abrir menu ou disparar `pointercancel`. `[hipótese]` | `Composer.tsx` | Voz instável em toque |
| R6 | Painel do núcleo no mobile é um `div role="dialog"` montado à mão (`fixed inset-x-3 bottom-32 top-20`), sem focus trap nem trava de rolagem. `[código]` | `ContextPanel.tsx` | Foco escapa; rolagem do fundo |
| R7 | Texto `text-2xs` (11 px, mono, caixa alta, tracking 0,12–0,3 em) em quase toda a UI; só sobe para 12 px em ponteiro grosso. `[código]` | `tokens.css`, `index.css` | Densidade alta, leitura cansativa |
| R8 | Linhas de conversa reservam `pr-28` (112 px) para as ações; no drawer (≈ 275 px) sobra pouco para o título. `[código]` | `SessionsSidebar.tsx` | Títulos truncados em tela estreita |
| R9 | "Aplicar e recarregar" usa `window.location.reload()`. `[código]` | `SettingsView.tsx` | Perde estado e rascunho |

### 3.2 Lentidão no streaming

| ID | Achado | Onde | Impacto |
|---|---|---|---|
| P1 | `ContextPanel` chama `useMessages(sessionId)` **só para contar mensagens**. Cada flush do stream (a cada 33 ms) re-renderiza o painel inteiro (~12 KB, muitos hooks e cálculos). No mobile ele fica montado, só escondido. `[código]` | `ContextPanel.tsx`, `chat/api.ts` | Trabalho desnecessário ~30×/s |
| P2 | Cada flush faz `setQueryData` + `.map` sobre todas as mensagens, e `MessageList` roda um efeito que escreve `scrollTop = scrollHeight` a cada atualização (layout síncrono). `[código]` | `use-chat.ts`, `MessageList.tsx` | Jank em respostas longas |
| P3 | O Markdown da resposta em andamento é **reprocessado inteiro** a cada flush; o custo cresce com o tamanho da resposta. `[código]` + `[doc]` (baseline confirma) | `MarkdownContent.tsx` | Streaming degrada ao fim da resposta |
| P4 | `TopBar` tem `setInterval` de 1 s dentro do componente inteiro (≈ 10 seletores de store): re-renderiza a barra toda a cada segundo. `[código]` | `TopBar.tsx` | Re-render contínuo |
| P5 | Sem `LazyMotion`, `MotionConfig`, `useShallow` ou `web-vitals` (planejados, não implementados). `[código]` | — | Sem telemetria; Motion completo |
| P6 | INP, LCP, CLS reais, perfil do React e aparelhos reais **nunca foram medidos**. `[doc]` | `BASELINE_WEB_MOBILE.md` | Otimizar às cegas |

### 3.3 Overlays que não abrem/fecham direito

| ID | Achado | Onde |
|---|---|---|
| O1 | **Quatro** mecanismos: `<dialog>` nativo (`SessionsSheet`), `div role=dialog` manual (`ContextPanel`), `motion.article role=dialog` (`ApiLetter`) e `alertdialog` **inline não modal** (`SessionsSidebar`, `MemoryView`). `[código]` |
| O2 | `useOverlayHistory` faz `history.pushState` próprio e `history.back()` ao fechar. Não conversa com a navegação por view e pode colidir se dois overlays abrirem. `[código]` + `[hipótese]` |
| O3 | A navegação é `activeView` no Zustand: **sem URL por tela**, sem deep link, e o Voltar do navegador sai do app. `[código]` |
| O4 | O gesto de arrastar para fechar o drawer só existe no cabeçalho (48 px de limiar). `ApiLetter` fecha por listener global de `Escape`, sem focus trap. `[código]` |

### 3.4 Visual

| ID | Achado | Onde |
|---|---|---|
| V1 | Tokens só em tema escuro. Cores **fixas** (`white/5`, `rgba(0,229,255,…)`, `#9beeff`, hex no `Orb`) impedem trocar de tema. `[código]` | `tokens.css`, `index.css`, `Orb.tsx` |
| V2 | Primitivos **duplicados por arquivo**: `Badge/Panel/Row` (Monitor), `SectionCard/SettingSwitch` (Ajustes), `StatusChip` (TopBar), `Field` (Auth). Botões repetem 150+ caracteres de classes. `cva` e `tailwind-merge` estão instalados, mas só `cn` é usado. `[código]` |
| V3 | Três famílias (Orbitron, Rajdhani, JetBrains Mono) em corpo de 11–13 px; hierarquia fraca. `[código]` |
| V4 | Troca de view é seca (`ChunkLoadBoundary key={activeView}`); sem transições de entrada de mensagem; skeletons só no chat. `[código]` |
| V5 | "Aparência" em Ajustes tem apenas "Reduzir animações". `[código]` |
| V6 | Seção Ollama em Ajustes está em linhas únicas e fora do padrão visual das demais. `[código]` |

### 3.5 Configuração, produto e dívida técnica

| ID | Achado | Onde |
|---|---|---|
| C1 | `ENV_DEMO = VITE_DEMO_MODE !== 'false'`: **sem a variável, o app sobe em modo demo**. O cadastro só aparece com `VITE_REGISTRATION_ENABLED === 'true'` (default desligado). Em um deploy sem essas variáveis, "criar conta" e provedores parecem não funcionar. `[código]` | `settings-store.ts`, `AuthView.tsx`, `AuthGate.tsx` |
| C2 | Rodapé da sidebar mostra "Histórico local · modo demonstração" **fixo**, mesmo no modo real/offline. `[código]` | `SessionsSidebar.tsx` |
| C3 | Chaves de provedores (BYOK) ficam dentro de **Monitor**; descoberta ruim. `[código]` | `ProviderKeysPanel.tsx` |
| C4 | Perfil: `displayName` é local e `'Operador'` funciona como valor sentinela (um usuário chamado "Operador" seria ignorado). `[código]` | `personalization.ts` |
| C5 | ESLint não roda: baseline registra `scopeManager.addGlobals is not a function` (combinação ESLint 10 + `typescript-eslint ^8.14` + `@eslint/js ^9`). O workflow de CI **nem tem passo de lint**. `[doc]` + `[código]` | `package.json`, `web-mobile-quality.yml` |
| C6 | Script `api:types` existe, mas `src/api/generated` não está no repositório. `[código]` | `package.json` |
| C7 | WebKit (Safari) e aparelhos reais não validados; guia cita `--kb-inset` inexistente. `[doc]` | `BASELINE_WEB_MOBILE.md` |

### 3.5.1 Estado dos itens de produto da Web (confirmado no código)

| Item | Estado | Observação |
|---|---|---|
| Criar conta | Implementado em `AuthView` + `registerAccount` | Depende de `VITE_REGISTRATION_ENABLED=true` no build e de `ALLOW_SELF_REGISTRATION=true` na API (ver C1) |
| Provedores com chave própria | Implementado (`ProviderKeysPanel`, `provider-keys.ts`) | Mover para Ajustes (C3) |
| Voz em tempo real | `SpeechStreamer` lê por frase durante o stream | Usa Web Speech API; `ttsEnabled` nasce desligado; só vozes pt-BR; sem pausa/retomar |
| Memória que influencia a IA | `buildPersonalization` envia até 20 memórias ativas ordenadas por sobreposição de palavras | Falta mostrar ao usuário quais memórias entraram na resposta |
| Perfil → nome na resposta | Envia `display_name` | Ver C4 |
| Painel "Núcleo Nexa" | Mostra provedor, modelo, chave própria/servidor, tokens, tempo, latência, tokens/s, memórias ativas | Métricas só em `sessionStorage`; o texto "CONECTADO À API REMOTA" não existe mais no código |
| Aparência Clássica | **Removida** (nota de 31/10/2026 nos docs) | Pode voltar como **tema** sobre os tokens (F2) |

---

## 4. Stack alvo

### 4.1 Manter

React 19 · TypeScript (`strict`) · Vite 8 · Tailwind 4 · Zustand · TanStack Query · Zod · Motion · Lucide · react-markdown (+ `remark-gfm`, `rehype-sanitize`) · Vitest · Testing Library · Playwright · axe · Lighthouse CI.

### 4.2 Adicionar (com justificativa e ordem de grandeza de bundle — **não medido**, confirmar com o visualizer)

| Biblioteca | Resolve | Custo estimado (gzip) | Fase |
|---|---|---|---|
| **Radix UI** (via shadcn/ui, copiando só o necessário): Dialog, AlertDialog, Tabs, Tooltip, DropdownMenu, Switch, Select | O1, R6, V2 | ~10–15 kB, em chunk lazy quando possível | F2–F3 |
| **Vaul** | Bottom sheet/drawer com arrastar nativo e snap points (conversas, Núcleo, API Letter) | ~8–10 kB, lazy | F3 |
| **Sonner** | Toasts com safe-area e deslizar para dispensar (substitui `NotificationCenter`) | ~4 kB | F3 |
| **TanStack Router** (alternativa: React Router em modo biblioteca) | O3, O2: rotas `/chat/:id`, `/memory`, `/monitor`, `/settings`; Voltar nativo; code-splitting por rota | ~12–15 kB | F3 |
| **React Hook Form** (+ resolver Zod) | Formulários de conta, perfil, memória, chaves | ~9 kB, lazy nas telas | F7 |
| **Shiki** ou `rehype-highlight`, **carregado sob demanda** | Código destacado nas respostas | lazy, por linguagem | F4 |
| **`web-vitals`** | P5, P6: telemetria de INP/LCP/CLS | ~2 kB | F0 |
| **`rollup-plugin-visualizer`** | Orçamento por chunk | dev only | F0 |
| **`@tanstack/react-virtual`** | Só se o Profiler mostrar custo em conversas longas | ~5 kB | F4 (condicional) |
| **`vite-plugin-pwa`** (opcional) | Instalável e shell offline, combinando com o modo Ollama | build only | F7 |

> **Folga de bundle:** o limite é 200 kB e o medido é 148,4 kB, ou seja, ~51 kB. Router + Radix + Vaul + Sonner no chunk inicial estouraria isso. Regra: só **Router e Sonner** entram no chunk inicial; Radix/Vaul/Shiki/RHF vão em chunks lazy, e `LazyMotion` reduz o Motion.

### 4.3 Não adotar

MUI, Chakra, Ant Design, Bootstrap (pesados e brigam com Tailwind) · tsparticles (o fundo precisa ficar mais leve) · GSAP/react-spring (Motion cobre) · Three.js global (só em caso pontual e opcional, ver F6) · Redux (Zustand + Query bastam).

### 4.4 A avaliar, sem compromisso

- **React Compiler:** só faz sentido depois de medir re-renders na F0/F4, e exige checar compatibilidade com Vite 8 + `@vitejs/plugin-react`.
- **`openapi-fetch`** sobre os tipos gerados, se a API tiver OpenAPI estável.

---

## 5. Design system proposto

### 5.1 Estrutura de pastas

```
src/
  components/
    ui/            # primitivos (Button, IconButton, Badge, Panel, Field, Switch, Tabs, Dialog, Sheet, Tooltip...)
    brand/         # NexaMark, Orb
  styles/
    tokens.css     # tokens base + temas por [data-theme]
    effects.css    # glow, grid, aurora, vidro (usa --glass-blur, --fx-level)
  features/...     # sem mudança de domínio
```

### 5.2 Tokens e temas

- Todo `white/xx` e `rgba(0,229,255,…)` vira token semântico: `--nexa-line`, `--nexa-line-strong`, `--nexa-fg-hi`, `--nexa-glow`, `--nexa-primary-rgb` (ou `color-mix`).
- Temas por atributo: `html[data-theme='hud' | 'violet' | 'classic' | 'light' | 'contrast']`. O **tema "Clássico"** devolve o visual sóbrio sem uma segunda aplicação.
- Um `--glass-blur` (0 em modo econômico) substitui o hack de R4.
- `Orb`: trocar `${color}33` (hex concatenado) por `color-mix(in oklab, var(--orb) 20%, transparent)` com `--orb` definido por estado.

```css
:root              { --glass-blur: 16px; --fx-level: 1; }
:root[data-fx='lite'] { --glass-blur: 0px;  --fx-level: 0; }   /* aparelho fraco / economia */

:root[data-theme='violet'] {
  --nexa-primary: #a78bfa;
  --nexa-secondary: #00e5ff;
  --nexa-border: rgba(167, 139, 250, 0.18);
}
:root[data-theme='light'] {
  color-scheme: light;
  --nexa-bg: #f4f7fb;  --nexa-surface: #ffffff;  --nexa-surface-2: #eef2f8;
  --nexa-text: #0b1526; --nexa-muted: #52627a;   --nexa-primary: #0077c8;
}
```

### 5.3 Primitivos (resolve V2)

`Button` (variantes: `primary | ghost | danger | outline`; tamanhos `sm | md | icon`), `IconButton`, `Badge/StatusChip`, `Panel/SectionCard`, `Field/Input/Textarea/Select`, `Switch`, `Tabs`, `Dialog/AlertDialog`, `Sheet` (Vaul), `Tooltip`, `Skeleton`, `EmptyState`. Todos com `cva` + `cn`, e **um** lugar para o alvo mínimo de 44 px em toque.

### 5.4 Tipografia

- Orbitron só em títulos curtos e marca; **Rajdhani para UI** em 14–16 px; JetBrains Mono para dados e código. Remover `uppercase` + `tracking` largo de textos acima de uma linha.
- Escala: `display / title / body (16) / caption (12)`. Piso de 12 px para texto informativo; 11 px só para rótulos decorativos curtos.

---

## 6. Plano em fases

> **Esforço relativo:** P ≈ até 1 dia · M ≈ 2–4 dias · G ≈ 1–2 semanas. São ordens de grandeza para sequenciar, não prazo.

### F0 — Medir e destravar o CI (P–M)

**Objetivo:** parar de otimizar às cegas (P6, C5, C7).

1. Corrigir o lint (C5): alinhar `eslint`, `@eslint/js` e `typescript-eslint` em versões compatíveis (ou fixar ESLint 9 até o ecossistema suportar a 10); trocar `tseslint.config(...)` pelo helper vigente; **adicionar `npm run lint` ao workflow**.
2. Adicionar `web-vitals` (log em dev e, se houver endpoint, envio) e `rollup-plugin-visualizer`.
3. Gravar traces do Chrome DevTools e do **React Profiler** em: streaming de resposta longa, abertura do Núcleo no mobile e digitação com teclado aberto. Throttle de CPU 4× e rede 4G.
4. Subir o job WebKit no CI usando a imagem oficial do Playwright (resolve "WebKit não inicia" de C7).
5. Checklist de aparelho real: um Android intermediário e um iPhone (Safari), nos fluxos F1/F3/F4.
6. Gerar e versionar `src/api/generated/openapi.d.ts` e adicionar `api:types:check` ao CI (C6).

**Aceite:** CI com lint verde; planilha com INP/LCP/CLS/long tasks por fluxo; WebKit rodando.

### F1 — Correções rápidas de alto impacto (P–M)

Tudo aqui é pequeno e independente; entra em PRs separados.

| Item | Mudança | Resolve |
|---|---|---|
| 1 | `useMessageCount(sessionId)` com `select: (m) => m.length` e uso no `ContextPanel` | P1 |
| 2 | Isolar `<Clock />` em componente próprio com `memo`; `TopBar` deixa de re-renderizar por segundo | P4 |
| 3 | Expor provedor/modelo/estado no mobile (linha compacta sob o título ou chip único abrindo o Núcleo) e trazer o **seletor de modelo offline** para um menu acessível em toque | R1 |
| 4 | Implementar `--kb-inset` e `data-keyboard="open"` em `use-visual-viewport.ts`; ocultar Dock com teclado aberto e posicionar o botão do Núcleo relativo à altura real do composer | R2, R3 |
| 5 | Mic: `touch-action: none`, `user-select: none`, `onContextMenu={e => e.preventDefault()}` no botão; manter fallback de toque-para-alternar em `pointer: coarse` | R5 |
| 6 | Trocar o hack `[class*='backdrop-blur']` por `backdrop-filter: blur(var(--glass-blur))` e `data-fx` | R4 |
| 7 | **Defaults de ambiente** (C1): validar `import.meta.env` com Zod no boot; `VITE_DEMO_MODE` default `false`; mostrar aviso claro quando o cadastro estiver desligado e **documentar** as duas variáveis no deploy (Vercel) e `ALLOW_SELF_REGISTRATION` na API | C1 |
| 8 | Rodapé da sidebar condicional ao modo (API / demo / offline) | C2 |
| 9 | "Aplicar conexão" sem `reload()`: reiniciar adaptador e invalidar queries | R9 |
| 10 | Atualizar `GUIA_RESPONSIVIDADE.md` para o que existe de fato | C7 |

```ts
// chat/api.ts
export function useMessageCount(sessionId: string | null) {
  return useQuery({
    queryKey: messageKeys.session(sessionId ?? 'none'),
    queryFn: () => (sessionId ? getChatAdapter().listMessages(sessionId) : Promise.resolve([])),
    enabled: Boolean(sessionId),
    select: (messages) => messages.length, // re-render só quando o número muda
  });
}
```

```ts
// use-visual-viewport.ts (trecho) — heurística; validar em iOS e Android reais
let baseline = window.innerHeight;
const update = () => {
  const keyboard = Math.max(0, baseline - viewport.height - viewport.offsetTop);
  root.style.setProperty('--kb-inset', `${keyboard}px`);
  root.dataset.keyboard = keyboard > 120 ? 'open' : 'closed';
};
window.addEventListener('orientationchange', () => { baseline = window.innerHeight; });
```

> Nota: `index.html` usa `interactive-widget=resizes-content` (Chrome/Android). O iOS Safari ignora essa opção, então a heurística precisa de teste nos dois.

**Aceite:** nenhuma re-renderização do `ContextPanel` durante o streaming (confirmar no Profiler); no mobile é possível trocar o modelo; com teclado aberto o Dock some; deploy sem env sobe em modo real.

### F2 — Design system, temas e primitivos (M–G)

1. Criar `components/ui/*` (seção 5.3) com `cva`; migrar **primeiro** `TopBar`, `Dock`, `ContextPanel` e `Composer`, depois Ajustes, Monitor, Memória e Auth.
2. Tokens semânticos + `data-theme` (hud, violeta, clássico, claro, contraste) e seletor de tema em Ajustes > Aparência. Persistir em `settings-store`.
3. Remover cores fixas (V1); `Orb` com `color-mix` e CSS vars.
4. Regra de lint: proibir classes longas repetidas fora de `components/ui` (`no-restricted-syntax` já existe para fontes < 11 px).
5. Tipografia (5.4) e escala de espaçamento.

**Aceite:** nenhum `StatusChip/Badge/Panel/Field` duplicado; trocar de tema muda 100% das superfícies sem hex fixo; axe verde nos 5 temas (ao menos contraste e claro).

### F3 — Overlays e navegação (M–G)

1. **Router:** rotas `/`, `/c/:sessionId`, `/memory`, `/monitor`, `/settings`. `activeView` sai do Zustand; `activeSessionId` vem da URL. Remover `use-overlay-history`.
2. **Overlays unificados:** Radix `Dialog/AlertDialog` (desktop e confirmações) + **Vaul** (mobile): drawer de conversas, **Núcleo Nexa** (bottom sheet com snap points ~50% e 90%), `ApiLetter`.
3. Substituir os `alertdialog` inline de `SessionsSidebar` e `MemoryView` por `AlertDialog` modal.
4. **Sonner** no lugar de `NotificationCenter`.
5. Overlays que precisam de URL (ex.: Núcleo aberto) podem usar search param (`?panel=core`), deixando o Voltar nativo fechá-los.

**Aceite (Playwright, mobile e desktop):** todo overlay abre e fecha por toque, arraste, `Esc` e Voltar; foco volta ao gatilho; rolagem do fundo travada; deep link `/c/:id` abre a conversa certa.

### F4 — Chat e streaming (M–G)

1. **Separar o texto em streaming do cache.** Manter a mensagem ativa em um store pequeno (`useStreamStore`) lida por **um** componente (`StreamingBubble`) via seletor; gravar no React Query só em `done`/`stopped`/`error`. Isso elimina o `.map` global e re-render da lista a cada flush (P2).
2. **Markdown em blocos memoizados** (P3): dividir a resposta em blocos de topo e renderizar cada um com `memo`; apenas o último bloco muda durante o stream.

```tsx
const Block = memo(({ source }: { source: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{source}</ReactMarkdown>
));

export function StreamingMarkdown({ content }: { content: string }) {
  const blocks = useMemo(() => splitTopLevelBlocks(content), [content]);
  return blocks.map((source, i) => <Block key={i} source={source} />);
}
```

   > `splitTopLevelBlocks` deve usar as **posições do AST** (`remark-parse`) e não só "linha em branco fora de cerca de código", que quebra listas ordenadas e listas soltas.
3. **Rolagem:** trocar o `scrollTop = scrollHeight` por `ResizeObserver` + `scrollIntoView` do âncora final, com `requestAnimationFrame` e só quando "colado no fim".
4. **Código:** destaque de sintaxe lazy (Shiki), botão **Copiar**, rolagem horizontal local.
5. `useShallow` nos seletores com múltiplos campos; `LazyMotion` (seção 7.1).
6. **Virtualização** só se o Profiler mostrar custo com ≥ 200 mensagens.
7. **Voz:** extrair uma interface `SpeechEngine` (Web Speech hoje; TTS de provedor depois), com fila, pausar/retomar e indicador "lendo" no Orb.
8. Transparência de memória: mostrar "N memórias usadas" por resposta (dados já saem de `buildPersonalization`).

**Aceite:** em resposta de 2 000+ tokens, tarefas longas (> 50 ms) p95 abaixo de um limite definido na F0; INP ≤ 200 ms ao digitar durante streaming; `ContextPanel` e `TopBar` sem re-render no stream.

### F5 — Layout responsivo por contexto (M–G)

Meta: uma **hierarquia por tamanho**, em vez de esconder coisas.

| Largura | Layout |
|---|---|
| < 640 px (celular) | Header compacto (marca + conversa + menu), **tab bar inferior** (some com teclado), conversas em drawer, Núcleo em bottom sheet, status em um único chip |
| 640–1023 px (tablet) | Rail lateral só com ícones (Chat/Memória/Monitor/Ajustes) em vez do Dock inferior; conversas em drawer persistente; Núcleo em sheet |
| 1024–1279 px | Sidebar de conversas + chat; Núcleo em sheet |
| ≥ 1280 px | Sidebar + chat + Núcleo fixo (`w-72`); em ≥ 1536 px, colunas com mais respiro e `max-w` de leitura no chat |

1. Usar **container queries** (já existem) para cards e painéis, deixando breakpoints de viewport só para o shell.
2. **Chaves de provedores** (C3): mover o painel para Ajustes > "Provedores de IA", mantendo um resumo em Monitor.
3. Ajustes com navegação por seções (Tabs) no desktop e lista de seções no mobile; padronizar a seção Ollama (V6).
4. Safe-area e `dvh`/`svh`/`lvh` revisados nos novos componentes; paisagem baixa (≤ 512 px) com layout próprio.
5. Perfil (C4): trocar o sentinela `'Operador'` por `displayName: ''` + placeholder; se houver endpoint de perfil na API, sincronizar (item de API, fora deste escopo).

**Aceite:** matriz `test:responsive` (320, 360, 390, 768, 1024, 1280, 1920, 3840 + paisagem baixa) sem rolagem horizontal e sem alvos < 44 px; nenhuma função exclusiva de desktop (regra 4 do guia).

### F6 — Efeitos visuais com orçamento (M)

Princípio: **poucos efeitos, bem feitos, e todos desligáveis.**

| Efeito | Como | Custo/risco |
|---|---|---|
| Entrada de mensagem | `m.div` com `opacity` + `y: 8`, 160–220 ms, só em mensagens novas | Baixo |
| Troca de view/rota | `AnimatePresence` + fade curto (120–180 ms) | Baixo |
| Indicador ativo da navegação | `layoutId` compartilhado (pílula que desliza entre abas) | Baixo |
| **Orb v2** | SVG/CSS com camadas; estados `idle/listening/processing/responding/error` por variável `--orb`; amplitude da voz via `AnalyserNode` (Web Audio) **somente quando ouvindo** | Médio |
| Aurora/gradiente do fundo | Gradiente CSS animado (`@property` ou duas camadas com `transform`), só em ponteiro fino | Baixo |
| Spotlight em cards | CSS var `--mx/--my` atualizada por `pointermove` (rAF), só ponteiro fino | Baixo |
| Skeletons | `Skeleton` único para chat, memória, monitor | Baixo |
| Vidro (blur) | Via `--glass-blur`; desligado em `data-fx='lite'` | Médio (GPU) |
| Canvas de partículas | Manter como está (≤ 54, parado em toque) | — |
| Three.js/R3F | **Opcional**, só no Orb de uma tela de destaque, em chunk próprio e atrás de `data-fx='full'` | Alto; não é necessário |

- **Modo de efeitos automático:** `data-fx` = `lite` se `prefers-reduced-motion`, `navigator.deviceMemory ≤ 4`, `hardwareConcurrency ≤ 4`, `saveData` ou FPS baixo medido por amostragem curta; o usuário pode forçar em Ajustes > Aparência (Completo / Equilibrado / Econômico / Reduzir animações).
- Animar apenas `transform` e `opacity`; nada de animação infinita fora de ponteiro fino.

```tsx
// providers.tsx
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';
// nos componentes: import * as m from 'motion/react-m';
<MotionConfig reducedMotion={settings.reducedMotion ? 'always' : 'user'}>
  <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
</MotionConfig>
```

**Aceite:** orçamento de efeitos documentado; nenhum efeito roda em toque sem justificativa; Lighthouse mobile ≥ 0,85 com todos os efeitos do modo "Equilibrado".

### F7 — Decompor telas grandes, formulários e acabamento (M–G)

1. **Dividir** `MonitorView` (23 KB), `MemoryView` (21 KB), `SettingsView` (17 KB), `SessionsSidebar` (13 KB), `ProviderKeysPanel` (12 KB) e `AuthView` (11 KB) em subcomponentes por seção, cada um com seus hooks.
2. **React Hook Form + Zod** em conta, perfil, memória e chaves; erros e foco consistentes com `Field`.
3. `ContextPanel`: extrair `useCoreMetrics(sessionId)` (cálculos fora do JSX) e persistir métricas além de `sessionStorage` se houver valor de produto.
4. **PWA opcional:** manifesto, ícones, service worker com *app shell*; combinar com o modo offline do Ollama.
5. **Testes:** Vitest para os primitivos; Playwright para overlays (F3), teclado virtual (emulação) e temas; testes visuais (screenshots) nos 3 breakpoints-chave.
6. **Docs:** consolidar `docs/` (marcar o que é histórico), registrar o design system e o guia de efeitos.

**Aceite:** nenhum arquivo de feature > ~250 linhas sem justificativa; cobertura de testes dos primitivos; docs coerentes com o código.

---

## 7. Métricas e orçamentos (para o CI)

| Métrica | Hoje | Meta | Como medir |
|---|---|---|---|
| JS inicial (gzip) | 148,4 kB `[doc]` | ≤ 200 kB (manter) | `check:bundle` |
| Cada chunk lazy | 3,6–4,7 kB (Ajustes/Monitor/Memória) | ≤ 40 kB | visualizer + script |
| LCP (4G, mobile) | não medido | ≤ 2,5 s | Lighthouse CI |
| INP | não medido | ≤ 200 ms (inclusive durante streaming) | `web-vitals` + Playwright |
| CLS | não medido | ≤ 0,1 | Lighthouse CI |
| Lighthouse perf (mobile) | mínimo 0,75 | ≥ 0,85 | LHCI |
| Lighthouse a11y | mínimo 0,90 | ≥ 0,95 | LHCI + axe |
| Re-renders no stream | `ContextPanel`/`TopBar` re-renderizam | zero fora da bolha ativa | React Profiler |
| Alvos de toque < 44 px | 0 na matriz | 0 | `e2e/targets.spec.ts` |

---

## 8. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Estourar o bundle com Router + Radix + Vaul + Sonner | Chunks lazy; `LazyMotion`; medir cada PR (regra do plano anterior: toda dependência nova entra com tamanho medido) |
| Heurística de teclado virtual diferente em iOS/Android | Testar em aparelho real (F0); manter `interactive-widget` e a heurística separados |
| Migração para rotas quebrar testes existentes (`activeView`) | Fazer F3 em PRs pequenos; manter um adaptador temporário `setActiveView → navigate` |
| Temas claros expõem cores fixas | F2 remove hex/rgba fixos antes de publicar o tema claro |
| Efeitos pesados em aparelho fraco | `data-fx` automático + orçamento de efeitos (F6) |
| Voz (Web Speech) varia por navegador | Interface `SpeechEngine` + mensagem clara de indisponibilidade |
| Regressões visuais em refactor grande | Screenshots no Playwright em 3 breakpoints; migração tela a tela |

---

## 9. Ordem recomendada (se for começar amanhã)

1. **Dia 1:** F0.1 (lint no CI), F1.1 (`select` no ContextPanel), F1.2 (Clock isolado), F1.7 (defaults de ambiente e documentação do deploy).
2. **Dias 2–3:** F1.3–F1.6 (modelo no mobile, teclado, mic, vidro) e F0.2–F0.5 (medição).
3. **Semana 2:** F2 (primitivos + temas) começando por `TopBar`, `Dock`, `Composer`.
4. **Semanas 3–4:** F3 (router + overlays) e F4 (streaming).
5. **Depois:** F5, F6, F7.

---

## 10. Checklist de PR (Definition of Done)

- [ ] Rodei `npm run lint`, `typecheck`, `test`, `test:responsive` e `check:bundle`.
- [ ] Medi o tamanho do bundle (visualizer) e justifiquei qualquer dependência nova.
- [ ] Verifiquei 320, 390, 768, 1280 e 1920 px, incluindo paisagem baixa e teclado virtual aberto.
- [ ] Overlays novos abrem e fecham por toque, arraste, `Esc` e Voltar; foco volta ao gatilho.
- [ ] Usei primitivos de `components/ui`; sem cores fixas nem `text-[Npx]` abaixo do mínimo.
- [ ] Efeitos novos respeitam `data-fx` e `prefers-reduced-motion`.
- [ ] Atualizei `docs/` quando o comportamento documentado mudou.

---

## 11. Limites desta análise

- Não executei o app, o CI nem os testes; não há medições minhas de INP, LCP, CLS ou do Profiler.
- Os custos de bundle da seção 4.2 são ordens de grandeza de memória e **devem ser confirmados** com o visualizer antes de decidir.
- Os itens marcados `[hipótese]` (R2, R3, R5 e parte de O2) precisam de reprodução em aparelho real.
- Itens que dependem da API (perfil sincronizado, histórico no servidor, endpoint de métricas) ficam fora do escopo e estão sinalizados onde aparecem.
