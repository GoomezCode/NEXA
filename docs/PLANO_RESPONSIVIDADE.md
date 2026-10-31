# NEXA Web — Plano de implementação: responsividade total (HUD + Clássico)

> Repositório alvo: `GoomezCode/NEXA` (React 19, TypeScript, Vite 8, Tailwind 4, Zustand, Motion).
> Base da análise: commit `6846f80` (`main`), com o modo OFFLINE já implementado.
> Local sugerido: `docs/PLANO_RESPONSIVIDADE.md`.
> Escopo: **somente a Web**. A API não muda.

---

## 0. Resumo executivo

### Objetivo

A Web inteira, **incluindo a interface Clássica**, deve funcionar bem em qualquer tela: celulares pequenos e grandes, dobráveis, tablets (retrato e paisagem), notebooks, desktops, monitores ultrawide e 4K. Deve funcionar também com toque, mouse, teclado, zoom de 200% e teclado virtual aberto.

### O que a medição mostrou (antes de qualquer mudança)

Subi a Web em modo demo e medi com Chromium 141 em 8 tamanhos de tela (320×568 a 1920×1080). Os números abaixo são reais; os scripts de medição viram teste automático na F0.

| Área | Resultado medido | Veredito |
|------|------------------|----------|
| **HUD, chat** | 0 itens fora da tela e 0 rolagem horizontal de 320 a 1920 px | Bom |
| **HUD, Ajustes** (320 e 390 px) | 8 controles com menos de 44 px (campos de 34–38 px, "Testar voz" com 40 px); 41 de 52 textos com menos de 12 px | Ajustar |
| **HUD, Monitor** (320 e 390 px) | 29 de 47 textos com menos de 12 px | Ajustar |
| **Login** (568×320, celular em paisagem) | O `main` fica com 641 px e o `body` tem `overflow: hidden`. O formulário é cortado em "Senha" e **não há como rolar**. O botão de baixo (y=500) fica inalcançável em tela de 320 px de altura | **Bug crítico** |
| **Clássico, abaixo de 1024 px** | Bloqueado por tela de aviso ("projetada para telas a partir de 1024px"). Ao "continuar mesmo assim", vira um layout de 1024 px com rolagem: 15–18 itens fora da tela em celulares, 8 em 768 px | **Não é responsivo** |
| **Clássico, controles** | 24 de 31 controles com menos de 44 px; 2 com menos de 24 px | Ajustar |
| **Clássico, textos** | 31 de 64 com menos de 10 px; 54 de 64 com menos de 12 px (há `fontSize` de 7, 8 e 9 px no código) | Ajustar |
| **Clássico, 1024 px ou mais** | Encaixa sem itens fora da tela. Em alturas baixas (1280×600) o núcleo é espremido | Aceitável |

### Achados de código que a medição não mostra

| # | Achado | Onde |
|---|--------|------|
| C1 | Campo de texto do chat com 14 px (`text-sm`). O Safari do iPhone dá zoom automático ao focar campos com menos de 16 px | `chat/Composer.tsx` |
| C2 | Tabelas do markdown sem contêiner de rolagem; mensagens sem quebra de palavra longa (URL grande estoura o balão) | `chat/MessageBubble.tsx` (`ReactMarkdown` sem `components`), `index.css` |
| C3 | Botão flutuante do painel do núcleo fixo em `bottom-20`, sem considerar dock, teclado ou safe-area; sobrepõe as dicas de atalho | `layout/ContextPanel.tsx` |
| C4 | Dicas "ENTER ENVIA · CTRL+K" aparecem em celulares, onde não existem | `chat/Composer.tsx` |
| C5 | Troca HUD ↔ Clássico some abaixo de 640 px (`hidden sm:flex`); só existe `Alt+M` e Ajustes | `layout/TopBar.tsx` |
| C6 | Clássico com layout fixo: colunas `w-72`, `marginTop: 56`, `marginBottom: 144`, núcleo 380×380, `VoiceBar` e `AppDock` com 72 px, notificação de 300 px em `top: 72, right: 20` | `ClassicApp.tsx`, `AICore.tsx`, `VoiceBar.tsx`, `AppDock.tsx`, `NotificationSystem.tsx` |
| C7 | Interações só por hover: ampliação do dock e dicas de ferramenta. A legenda "SWIPE UP" existe, mas **não há tratamento de gesto** | `AppDock.tsx` |
| C8 | Estilos inline em px por todo o Clássico (impedem media query e escala com a fonte do usuário) | `classic/components/*` |
| C9 | Fontes em `px` (`text-[10px]`: 138 usos, `text-[11px]`: 47, `text-[9px]`: 9). Não acompanham o tamanho de fonte do navegador/Android | HUD |
| C10 | Canvas de partículas com custo O(n²) e sem pausa quando a aba fica oculta; efeitos `backdrop-blur` em muitas camadas (pesado em celular modesto) | `classic/Background.tsx`, `layout/BackgroundCanvas.tsx` |
| C11 | Teclado virtual: nada trata `visualViewport`; no iOS o teclado cobre o campo de mensagem | Composer, Console |

### Já está bom (não mexer)

`<meta viewport>` com `viewport-fit=cover` e **sem** bloqueio de zoom; `h-dvh` no `AppShell`; dock móvel com `env(safe-area-inset-bottom)`; alvos de 44 px nos controles principais (já testados em `e2e/targets.spec.ts`); `prefers-reduced-motion`; drawer de conversas; painel de contexto como sobreposição abaixo de `xl`.

### Estimativa

Cerca de **14 dias úteis** para uma pessoa (indicativo). Ver seção 6.

---

## 1. Regras de responsividade (critérios de aceite do projeto)

Estas dez regras valem para HUD **e** Clássico. Cada uma vira teste automático (F0/F7).

| # | Regra | Como medir |
|---|-------|-----------|
| R1 | Sem rolagem horizontal do documento de 320 a 3840 px | `scrollWidth <= clientWidth` |
| R2 | Alvos de toque ≥ 44×44 px em ponteiro grosso e ≥ 24×24 px sempre (WCAG 2.5.8) | Bounding box dos controles visíveis |
| R3 | Texto informativo ≥ 12 px, rótulos decorativos ≥ 11 px, campos de formulário 16 px em toque; unidades em `rem` | `getComputedStyle` + lint |
| R4 | Nenhuma função depende só de hover | Revisão + teste com `hasTouch` |
| R5 | Tudo cabe ou rola: nenhum botão inalcançável em altura de 320 px | `scrollIntoViewIfNeeded` e posição na janela |
| R6 | Safe-area respeitada nos quatro lados (notch, barra de gestos, paisagem) | Teste com `env()` simulado + revisão |
| R7 | Teclado virtual nunca cobre o campo ativo | `visualViewport` + teste manual em aparelho |
| R8 | Girar a tela ou redimensionar **não perde estado** (conversa em streaming, rascunho, aba ativa) | Teste e2e com `setViewportSize` durante streaming |
| R9 | Zoom de 200% e reflow em 320 px de largura sem perda de função (WCAG 1.4.4 e 1.4.10) | Viewport 320 px + `deviceScaleFactor` |
| R10 | Animações respeitam `prefers-reduced-motion` e a interface permanece fluida em aparelho modesto | Perfil com CPU 4× mais lenta |

---

## 2. Matriz de dispositivos e navegadores

### Classes de tela (viewport CSS)

| Classe | Faixa de largura | Exemplos de teste |
|--------|------------------|-------------------|
| Dobrável fechado | ~280–360 | 280×653 |
| Celular pequeno | 320–374 | 320×568, 360×740 |
| Celular | 375–479 | 375×667, 390×844, 412×915, 430×932 |
| Celular em paisagem | altura < 500 | 568×320, 667×375, 844×390, 932×430 |
| Dobrável aberto / phablet | 600–767 | ~700×840 |
| Tablet retrato | 768–1023 | 768×1024, 820×1180, 1024×1366 |
| Tablet paisagem / notebook pequeno | 1024–1279 | 1024×768, 1180×820 |
| Notebook / desktop | 1280–1919 | 1280×720, 1366×768, 1440×900 |
| Desktop grande | 1920–2559 | 1920×1080 |
| QHD, ultrawide, 4K | ≥ 2560 | 2560×1440, 3440×1440, 3840×2160 |

Também: altura baixa (1280×600), zoom do navegador a 200% e 400%, texto ampliado nas configurações do sistema.

### Entradas e navegadores

- **Entradas:** toque, mouse, teclado, caneta; híbridos (notebook com tela de toque).
- **Navegadores:** o Tailwind 4 já define o piso (Safari 16.4+, Chrome 111+, Firefox 128+). Cobrir Chrome/Edge, Firefox e Safari (iOS e macOS), mais Samsung Internet na checagem manual.
- **Fora do escopo:** TV e quiosque (navegação por direcional). A navegação por teclado e o foco visível já existentes ajudam, mas não há trabalho dedicado.

---

## 3. Decisões de arquitetura

### D1 — Mobile-first com três eixos de adaptação

1. **Largura** (breakpoints do Tailwind: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536).
2. **Altura** (variante nova `short`: `max-height: 32rem`) para celular em paisagem.
3. **Tipo de ponteiro** (`pointer-coarse:` e `pointer-fine:`, disponíveis no Tailwind 4.1+; o projeto usa 4.3) para tamanho de alvo e hover.

Em `index.css`:

```css
@custom-variant short (@media (max-height: 32rem));
@custom-variant xs (@media (min-width: 30rem));        /* 480px */
```

### D2 — CSS primeiro, JavaScript só para mudar a estrutura

Ajustes de tamanho, espaçamento e visibilidade ficam em CSS. Mudança de **árvore de componentes** (por exemplo, painéis em colunas versus abas) usa o hook `useLayoutClass()` com `matchMedia`, sem `innerWidth` nem listener de `resize`. O estado nunca fica dentro do componente que troca: fica no provider (`AppProvider`, `useUiStore`), para a rotação não perder nada (R8).

### D3 — Tokens de dimensão em `rem`, no lugar de `px` soltos

Em `tokens.css` e `classic.css`:

```css
:root {
  --text-2xs: 0.6875rem;   /* 11px: rótulos decorativos (mínimo) */
  --text-xs-plus: 0.75rem; /* 12px: texto informativo */
  --target-min: 2.75rem;   /* 44px */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --kb-inset: 0px;         /* preenchido por useVisualViewport */
}
```

`text-[10px]` e `text-[11px]` viram `text-2xs`; `text-[9px]` sobe para `text-2xs`. Os tamanhos fixos do Clássico (altura da barra superior, do dock, da barra de voz, largura dos painéis, diâmetro do núcleo) viram variáveis (`--c-topbar-h`, `--c-dock-h`, `--c-panel-w`, `--c-core`), definidas por breakpoint.

### D4 — Quatro layouts para o Clássico

O Clássico deixa de ser "réplica de desktop" e ganha uma composição por classe de tela. **No desktop (≥ 1280 px) o visual permanece idêntico ao atual**, protegido por teste de imagem (F0).

```
DESKTOP ≥1280                       MÉDIO 768–1279
┌ TopBar ──────────────────────┐    ┌ TopBar ───────────────────┐
│ ┌────┐   ( núcleo )  ┌────┐  │    │  ( núcleo )  ┌ abas ────┐ │
│ │MON │   métricas    │CON │  │    │  métricas    │CONSOLE   │ │
│ │MEM │   ações       │SRC │  │    │  ações       │MONITOR   │ │
│ └────┘               └────┘  │    │              │MEMORY    │ │
├ VoiceBar ────────────────────┤    │              │SEARCH    │ │
└ AppDock ─────────────────────┘    ├ VoiceBar + AppDock ───────┤

COMPACTO <768 (retrato)             CURTO (altura <500, paisagem)
┌ TopBar 48 (logo·estado·🔔·⋯) ┐    ┌ TopBar 40 ───────────────┐
│ métricas (rolagem horizontal)│    │ ( núcleo )  │ CONSOLE    │
│        ( núcleo )            │    │ (70dvh)     │ (rolagem)  │
│ ações (chips rolantes)       │    │             │ > comando🎤│
│ [CONSOLE|MON|MEM|SEARCH]     │    ├ Dock 44 ─────────────────┤
│ painel ativo (rolagem)       │    └──────────────────────────┘
│ > comando…           [🎤][➤] │
├ Dock 5 ícones + safe-area ───┤
└──────────────────────────────┘
```

Regras:

- **Compacto:** um único painel visível por vez (aba), com **Console como padrão** (é o chat). `VoiceBar` é incorporada à linha de entrada (botão de microfone); a forma de onda só aparece enquanto ouve. O dock vira barra de 5 itens com rótulo visível (sem ampliação por hover).
- **Médio:** núcleo à esquerda, painel com abas à direita (Console, Monitor, Memory, Search).
- **Curto:** duas colunas (núcleo e console), barra superior e dock reduzidos.
- **Estado compartilhado:** hoje há `leftPanel` e `rightPanel`. Passa a existir também `activePanel` (`console | monitor | memory | search`) no `AppProvider`, e os dois modelos são mantidos em sincronia, para girar a tela não trocar o que o usuário está vendo.
- **Rascunho do console** sobe para o contexto para não ser perdido quando a árvore muda.

### D5 — Núcleo (AICore) fluido

O `AICore` usa 380×380 e anéis de 340/300/…/180/160/120 px. Troca por um tamanho medido do contêiner (`ResizeObserver` → `--c-core`), e cada anel vira `calc(var(--c-core) * fração)`. Assim o núcleo cresce em 4K e encolhe em celular sem `transform: scale` borrado.

### D6 — Teclado virtual

Hook `useVisualViewport()` escreve `--kb-inset` (diferença entre `innerHeight` e `visualViewport.height + offsetTop`). O campo de mensagem e o console usam `padding-bottom: max(var(--safe-bottom), var(--kb-inset))` e rolam o campo ativo para a vista. No `index.html`, adicionar `interactive-widget=resizes-content` ao viewport (efeito em Chrome para Android; o Safari do iPhone ignora, por isso o hook é necessário).

### D7 — Hover só como reforço

`@media (hover: hover) and (pointer: fine)` envolve ampliação do dock, dicas de ferramenta e efeitos `onMouseEnter`. No toque, o mesmo conteúdo aparece como rótulo fixo ou na pressão longa. A legenda "SWIPE UP" é **implementada** (arrastar o dock para cima abre o `AppGrid`) ou **removida**; não pode prometer um gesto que não existe.

### D8 — Desempenho em aparelho modesto

Canvas de fundo: limitar a resolução (`devicePixelRatio` até 2), quantidade de partículas proporcional à área e menor em telas compactas, pausa em `visibilitychange` e em `prefers-reduced-motion`. Em telas compactas, `backdrop-filter` dá lugar a fundo sólido semitransparente nas camadas sobrepostas.

---

## 4. Fases de implementação

Dependências: `F0 → F1 → (F2 ∥ F3) → F4 → F5 → F6 → F7 → F8`.

### F0 — Baseline e rede de segurança (≈ 1 dia)

- [ ] Criar `e2e/responsive/` com helpers e a matriz de projetos (seção 5). Reaproveitar os scripts de medição desta análise como testes: sem rolagem horizontal, alvos mínimos, texto mínimo, alcançabilidade.
- [ ] Marcar como `test.fixme` os testes que hoje falham, cada um apontando para a fase que corrige. Assim o CI fica verde e cada fase "liga" seus testes.
- [ ] **Snapshots de referência do desktop** (HUD e Clássico em 1440×900 e 1920×1080, canvas oculto e animações desligadas), para provar que nada muda onde já estava bom.
- [ ] Novo script `npm run test:responsive`.
- [ ] Documentar o baseline medido (seção 0) em `docs/`.

**Pronto quando:** `npm run test:responsive` roda, os `fixme` listam exatamente os defeitos da seção 0 e os snapshots de desktop estão versionados.

### F1 — Fundação (≈ 1,5 dia)

- [ ] `index.css`: variantes `short` e `xs`; tokens da seção D3; `html { -webkit-text-size-adjust: 100% }`; `touch-action: manipulation` em botões e links (elimina atraso de toque); `overscroll-behavior: contain` nos contêineres de rolagem; `text-wrap: pretty` em parágrafos.
- [ ] `@theme`: `--text-2xs`, `--text-xs-plus`; **codemod** (`sed`/script) de `text-[9px|10px|11px]` para `text-2xs`, e revisão manual dos que precisam de 12 px (informativos).
- [ ] Hooks em `src/hooks/`: `useLayoutClass()` (`compact | medium | expanded` e `short`), `usePointerType()`, `useVisualViewport()`, `useElementSize()`.
- [ ] `index.html`: `interactive-widget=resizes-content` no viewport (sem `maximum-scale`, preservando o zoom).
- [ ] Campos de formulário a 16 px em toque (`pointer-coarse:text-base`) e 44 px de altura mínima, via classe utilitária `nexa-field`.
- [ ] ESLint: regra `no-restricted-syntax` que acusa `fontSize: '<11px'` inline e `text-[<11px]` (guarda contra regressão).

**Pronto quando:** os hooks têm testes unitários (mock de `matchMedia`) e o codemod não altera nenhum snapshot de desktop além do esperado.

### F2 — Correções críticas do HUD (≈ 1 dia)

- [ ] **Login** (`AuthView.tsx`): trocar `min-h-dvh … overflow-y-auto` por contêiner `fixed inset-0 overflow-y-auto` com conteúdo `min-h-full` e `my-auto`, de modo que o formulário role em qualquer altura. Revisar o mesmo padrão em `ErrorBoundary`, telas de carregamento e `App.tsx`.
- [ ] **Composer**: 16 px em toque (C1); esconder dicas de teclado em `pointer-coarse` (C4); `padding-bottom` com `--kb-inset` e safe-area (D6); `enterKeyHint="send"`.
- [ ] **Botão do painel do núcleo**: sair do `fixed bottom-20` e ir para o cabeçalho do chat (ou ancorar em `calc(var(--dock-h) + var(--kb-inset) + var(--safe-bottom) + .5rem)`), sem sobrepor texto (C3).
- [ ] **Markdown**: `ReactMarkdown` com `components.table` envolvendo em `div.overflow-x-auto`; `overflow-wrap: anywhere` nas mensagens (usuário e NEXA); `img { height: auto }`; `pre` com rolagem horizontal visível (C2).
- [ ] **Troca de interface em celular**: o interruptor HUD ↔ Clássico fica acessível abaixo de 640 px (item no menu de Ajustes já existe; adicionar atalho visível no cabeçalho ou no Monitor) (C5).
- [ ] **Ajustes e Monitor**: campos e botões com 44 px em toque; rótulos de 11–12 px; o círculo decorativo do Monitor que ultrapassa a largura recebe `overflow-hidden` no pai.

**Pronto quando:** em 568×320 todo o formulário de login é alcançável; no iPhone o foco no campo não dá zoom; tabela larga rola dentro do balão.

### F3 — HUD adaptativo completo (≈ 2 dias)

- [ ] **Celular em paisagem** (`short:`): barra superior de 44–48 px, dock vira trilho vertical lateral (`short:flex-row` no `AppShell`), banner de demonstração em uma linha, chat ganha a altura.
- [ ] **Tablet retrato (768–1023)**: sessões em barra lateral recolhível em vez de somente drawer (hoje só aparece em `lg`); painel do núcleo como painel lateral sobreposto.
- [ ] **Tablet paisagem (1024–1279)**: sessões fixas, painel do núcleo em drawer; sem perder a largura de leitura (`max-w-3xl`).
- [ ] **Dobráveis**: testar 280 px (dobrado) e ~700 px (aberto); usar `min-width: 0` e `flex-wrap` nos cabeçalhos; ao cruzar a dobra o estado persiste (R8).
- [ ] **Telas grandes (≥ 1920) e ultrawide**: limitar a largura de leitura, centralizar, e escalar a base tipográfica de forma contínua (por exemplo, `html { font-size: clamp(16px, 0.55vw + 8px, 20px) }` a partir de 1536 px). Isso só funciona porque a F1 trocou `px` por `rem`.
- [ ] **Diálogos e folhas** (`SessionsSheet`, painéis): `max-height: 100dvh` com rolagem interna; `NotificationCenter` com `top: var(--safe-top)` e largura `min(22rem, 100vw - 1.5rem)`.
- [ ] **Memória e Monitor**: grades que passam de 1 para 2–3 colunas por `@container` (largura do painel, não da janela).

**Pronto quando:** a matriz inteira da seção 2 passa nas regras R1–R9 no HUD.

### F4 — Clássico: arquitetura responsiva (≈ 2 dias)

- [ ] **Remover** o bloqueio de 1024 px (`narrow`, `forceWide`) e o modo `classic-hud--scroll` com `min-width: 1024px` em `ClassicApp.tsx` e `classic.css`.
- [ ] `useLayoutClass()` decide entre `DesktopLayout`, `MediumLayout`, `CompactLayout` e `ShortLayout`, extraídos de `MainLayout` (hoje com 3 colunas fixas). Os painéis (`SystemMonitor`, `MemoryPanel`, `CommandConsole`, `SearchPanel`) são os **mesmos componentes**, apenas reposicionados.
- [ ] `AppProvider` ganha `activePanel` e o rascunho do console (D4); a lógica de `leftPanel`/`rightPanel` do desktop continua.
- [ ] Tokens do Clássico em `classic.css` (D3): `--c-topbar-h`, `--c-dock-h`, `--c-voice-h`, `--c-panel-w: clamp(16rem, 22vw, 22rem)`, `--c-gap`. As margens `marginTop: 56` e `marginBottom: 144` passam a usar essas variáveis.
- [ ] Remover o `style={{ marginTop, marginBottom }}` e usar grid (`grid-template-rows: var(--c-topbar-h) 1fr auto`) para o miolo ocupar exatamente o espaço restante.
- [ ] Atualizar o texto de `Ajustes → Modo de interface` (hoje "Réplica fiel…").

**Pronto quando:** o Clássico abre em 320 px sem aviso de bloqueio e alterna entre os quatro layouts sem perder a conversa.

### F5 — Clássico: componentes (≈ 3 dias)

Um item por arquivo:

- [ ] **`TopBar.tsx`**: compacto mostra logo, estado, sino e menu "⋯"; os chips API/MODELOS/PROVEDORES/COTA e o relógio vão para dentro do menu (ou para uma linha rolável). Alvos de 44 px; safe-area superior e laterais.
- [ ] **`AICore.tsx`**: tamanho por `--c-core` (D5); rótulos de 8 px sobem para 11 px; área de toque do núcleo ≥ 44 px mesmo reduzido.
- [ ] **`VoiceBar.tsx`**: compacto funde na linha de entrada do console (microfone e mudo viram ícones de 44 px); altura por `--c-voice-h`; safe-area inferior.
- [ ] **`AppDock.tsx`**: ampliação e dicas só com `hover: hover`; no toque, rótulos fixos e 5 itens equidistantes; "SWIPE UP" implementado com `onPointerDown/Move/Up` (limiar de ~40 px) ou removido (D7).
- [ ] **`CommandConsole.tsx`**: campo a 16 px em toque; botões de 28 px sobem para 44 px; chips de sugestão em rolagem horizontal no compacto; balões com `overflow-wrap: anywhere`.
- [ ] **`SystemMonitor`, `MemoryPanel`, `SearchPanel`**: textos de 8–9 px sobem para 11–12 px; abas com `min-h-11`; listas com rolagem interna.
- [ ] **Sobreposições** (`AppGrid`, `SettingsPanel`, `ScanningPanel`, `GesturePanel`): em compacto ocupam a tela inteira com `padding` de safe-area e botão de fechar de 44 px; grade do `AppGrid` com `repeat(auto-fit, minmax(7rem, 1fr))`; `max-height: 100dvh` com rolagem.
- [ ] **`NotificationSystem.tsx`**: largura `min(20rem, 100vw - 2rem)`, posição `top: calc(var(--safe-top) + var(--c-topbar-h))`, `right/left` com safe-area; alvo de fechar de 44 px.
- [ ] **`GesturePanel`**: conteúdo coerente em toque (hoje descreve controles gestuais de câmera/atalhos; verificar o que faz sentido sem mouse).

**Pronto quando:** o Clássico passa R1–R9 em toda a matriz e os snapshots de desktop da F0 continuam idênticos (ou com diferença aprovada).

### F6 — Desempenho e movimento (≈ 1 dia)

- [ ] `Background.tsx` e `BackgroundCanvas.tsx`: `devicePixelRatio` limitado a 2; partículas proporcionais à área (`count = clamp(12, área / 18000, 54)`) e reduzidas em compacto; laço O(n²) limitado por distância; `visibilitychange` pausa o `requestAnimationFrame`.
- [ ] Animações infinitas do `AICore` (anéis): parar quando fora da tela (`IntersectionObserver`) e respeitar `reducedMotion` do app e do sistema.
- [ ] `backdrop-filter` apenas em desktop; fundo sólido nas folhas e painéis em compacto.
- [ ] Medir com CPU 4× mais lenta (CDP `Emulation.setCPUThrottlingRate`): sem tarefas longas ao digitar; meta orientativa de INP abaixo de 200 ms e CLS abaixo de 0,1.

**Pronto quando:** o Clássico em compacto mantém fluidez durante streaming com CPU reduzida e a bateria/CPU não disparam com a aba em segundo plano.

### F7 — Testes e QA (≈ 2 dias)

- [ ] Ligar todos os testes `fixme` da F0.
- [ ] **Matriz Playwright** (seção 5) em Chromium, WebKit e Firefox.
- [ ] **Rotação durante streaming** (R8): iniciar resposta, `setViewportSize` de retrato para paisagem, afirmar que a mensagem continua e o rascunho permanece.
- [ ] **Reflow e zoom**: viewport de 320×256 (equivale a 400% em 1280×1024) e fator de escala 2; sem perda de função.
- [ ] **axe-core** em 320, 768 e 1280 px, HUD e Clássico, todas as telas.
- [ ] **Atualizar testes existentes**: o teste de `e2e/classic.spec.ts` que espera o aviso "Continuar mesmo assim" passa a esperar o Clássico funcional em 390 px; revisar `shell.spec.ts` e `targets.spec.ts` (estender os 44 px ao Clássico).
- [ ] **Checklist manual em aparelho real** (seção 7): ao menos um iPhone (Safari), um Android (Chrome), um iPad e um notebook com tela de toque.

### F8 — Documentação e proteção contra regressão (≈ 0,5 dia)

- [ ] `README.md`: seção "Compatibilidade" (dispositivos, navegadores, atalhos).
- [ ] `docs/GUIA_RESPONSIVIDADE.md`: as dez regras, tokens, variantes e padrão de contêiner de rolagem.
- [ ] Checklist de PR: "testei em 320 / 768 / 1280, em paisagem e com teclado aberto".
- [ ] CI roda `test:responsive` nos três navegadores (só `chromium` em PRs; matriz completa na `main`).

---

## 5. Estratégia de testes

### Projetos do Playwright (`playwright.config.ts`)

Hoje existe só `Desktop Chrome`. Adicionar (os nomes dos dispositivos devem ser conferidos na lista `devices` da versão instalada):

```ts
projects: [
  { name: 'chromium',          use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox',           use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit',            use: { ...devices['Desktop Safari'] } },
  { name: 'phone-small',       use: { ...devices['iPhone SE'] } },
  { name: 'phone',             use: { ...devices['Pixel 7'] } },
  { name: 'phone-landscape',   use: { ...devices['iPhone 14 landscape'] } },
  { name: 'tablet',            use: { ...devices['iPad (gen 7)'] } },
  { name: 'tablet-landscape',  use: { ...devices['iPad (gen 7) landscape'] } },
  { name: 'laptop',            use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  { name: 'desktop-qhd',       use: { ...devices['Desktop Chrome'], viewport: { width: 2560, height: 1440 } } },
],
```

Para WebKit e Firefox no CI: `npx playwright install --with-deps`.

### Helpers (`e2e/responsive/helpers.ts`)

```ts
import { expect, type Locator, type Page } from '@playwright/test';

export async function expectNoHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw, 'rolagem horizontal do documento').toBeLessThanOrEqual(cw);
}

export async function expectTouchTargets(page: Page, min = 44) {
  const small = await page.evaluate((min) =>
    [...document.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select, [role=button], [role=tab]')]
      .filter((el) => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        const visible = r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        return visible && !el.closest('.sr-only') && (r.width < min || r.height < min);
      })
      .map((el) => `${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 24)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
    min);
  expect(small, 'alvos menores que o mínimo').toEqual([]);
}

export async function expectReachable(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const vp = locator.page().viewportSize()!;
  expect(box && box.y >= 0 && box.y + box.height <= vp.height, 'botão fora da janela após rolar').toBe(true);
}

export async function expectReadableText(page: Page, minPx = 11) {
  const tiny = await page.evaluate((minPx) =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))
      .filter((el) => el.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(el).fontSize) < minPx)
      .map((el) => el.textContent!.trim().slice(0, 24)),
    minPx);
  expect(tiny, `textos abaixo de ${minPx}px`).toEqual([]);
}
```

### Casos por tela (executados em cada projeto)

| Tela | Verificações |
|------|--------------|
| Login e Cadastro (incluindo o botão **OFFLINE**) | R1, R5 (`expectReachable` no último botão), campos a 16 px em toque |
| HUD: chat, Memória, Monitor, Ajustes | R1, R2, R3 |
| HUD: drawer, painel do núcleo, diálogos | Cabem na janela; fechar com 44 px |
| Clássico: todos os painéis e sobreposições | R1–R5, abas alcançáveis em compacto |
| Clássico: dock, voz, notificações | Safe-area, sem sobreposição entre barras |
| Streaming + rotação | R8 |

### Imagens de referência

`toHaveScreenshot` com canvas ocultos (`page.addStyleTag` em `canvas { visibility: hidden }`), `reducedMotion: 'reduce'` e `maxDiffPixelRatio` baixo. Linhas de base: HUD e Clássico em 390×844, 768×1024, 1440×900 e 1920×1080.

---

## 6. Cronograma

| Fase | Entrega | Dias |
|------|---------|-----:|
| F0 | Baseline, testes e snapshots de desktop | 1 |
| F1 | Tokens, variantes, hooks, codemod, lint | 1,5 |
| F2 | Correções críticas do HUD (login, composer, markdown) | 1 |
| F3 | HUD adaptativo completo | 2 |
| F4 | Clássico: arquitetura (4 layouts, sem bloqueio) | 2 |
| F5 | Clássico: componentes | 3 |
| F6 | Desempenho e movimento | 1 |
| F7 | Testes, axe, aparelhos reais | 2 |
| F8 | Documentação e CI | 0,5 |
| | **Total** | **≈ 14** |

**Marcos úteis:** ao fim da F2 o HUD já não tem bugs bloqueantes (login em paisagem, zoom no iPhone). Ao fim da F4 o Clássico deixa de ser bloqueado em telas pequenas, mesmo antes do acabamento da F5. F2 e F3 podem andar em paralelo com a F4 se houver duas pessoas.

---

## 7. Checklist manual em aparelho real

- [ ] **iPhone (Safari):** campo de mensagem não dá zoom; teclado não cobre o campo; barra de endereço recolhendo não corta o dock; notch e barra de gestos respeitados; girar a tela no meio de uma resposta.
- [ ] **Android (Chrome):** `interactive-widget` redimensiona ao abrir o teclado; botão voltar do sistema fecha drawers e sobreposições; fonte do sistema a 130% e 200%.
- [ ] **iPad:** retrato, paisagem e Split View (⅓ e ½ da tela).
- [ ] **Dobrável (ou emulador):** dobrado e aberto sem perder a conversa.
- [ ] **Notebook com toque:** mouse e toque na mesma sessão; alvos de 44 px quando se toca.
- [ ] **Monitor 4K / ultrawide:** sem esticar o texto; núcleo proporcional.
- [ ] **Zoom do navegador em 200% e 400%** em notebook.
- [ ] Modo **OFFLINE** (Ollama) navegável em todos os itens acima.

---

## 8. Riscos e mitigação

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Reescrita de estilos inline do Clássico quebra o visual de desktop | Regressão visual | Snapshots de desktop na F0; migrar por componente, nunca em lote |
| Trocar a árvore de componentes ao girar a tela perde estado | Usuário perde conversa ou rascunho | Estado no provider (D2/D4); teste de rotação durante streaming (R8) |
| Dois layouts montados ao mesmo tempo duplicam canvas e custo | Lentidão e IDs duplicados | Renderizar **um** layout por vez via `useLayoutClass()`; nunca esconder com `display: none` |
| `rem` fluido em telas grandes altera todo o HUD | Densidade diferente em 1536+ | Aplicar só a partir de 1536 px, medir contra os snapshots e ter chave simples para desligar |
| Teclado virtual varia entre iOS e Android | Campo coberto em um deles | `useVisualViewport()` + `interactive-widget`; checklist manual (seção 7) |
| Hover removido no toque piora a descoberta de recursos | Funções "escondidas" | Rótulos fixos no toque (D7) |
| Fidelidade com a "referência histórica" (`web_referencia`) | Divergência intencional em telas pequenas | Documentar que a fidelidade vale para ≥ 1280 px; texto de Ajustes atualizado |
| Safari/WebKit e Firefox exibem diferenças de `dvh`, `env()` e `backdrop-filter` | Bugs só em um navegador | Matriz com WebKit e Firefox desde a F0 |
| Aparelho modesto com Clássico animado | Engasgos | F6 (canvas, animações pausadas, sem blur) e medição com CPU reduzida |
| Dimensões "mágicas" voltarem com novos componentes | Regressão silenciosa | Regra ESLint (F1) e checklist de PR (F8) |

---

## 9. Definição de pronto

- [ ] Login e Cadastro rolam e todo botão (inclusive **OFFLINE**) é alcançável em 568×320.
- [ ] HUD e Clássico passam R1–R9 em toda a matriz da seção 2.
- [ ] O Clássico abre em 320 px, sem aviso de bloqueio, com os mesmos recursos do desktop (Console, Monitor, Memory, Search, voz, dock, apps, diagnóstico, gestos).
- [ ] Nenhuma ação depende só de hover; "SWIPE UP" funciona ou foi removido.
- [ ] No iPhone o foco nos campos não dá zoom e o teclado não cobre o campo ativo.
- [ ] Girar a tela durante o streaming não perde mensagem, rascunho nem aba ativa.
- [ ] Desktop (≥ 1280 px) visualmente igual ao baseline, com diferenças só aprovadas.
- [ ] `npm run check`, `test:e2e` e `test:responsive` verdes em Chromium, WebKit e Firefox; axe sem violações.
- [ ] Checklist manual (seção 7) executado em aparelhos reais.
- [ ] README e `docs/GUIA_RESPONSIVIDADE.md` atualizados.

---

## 10. Fora de escopo

- Aplicativo nativo, PWA instalável e service worker.
- TV e quiosque (navegação por direcional/controle remoto).
- Redesenho visual (paleta, tipografia, identidade). Só se muda tamanho, disposição e comportamento.
- Novas funções do Clássico. Os recursos atuais são **mantidos**, apenas reorganizados.
- Alterações na API ou no modo OFFLINE (apenas garantir que ele também fique responsivo).

---

## 11. Suposições assumidas (me avise se alguma estiver errada)

1. No desktop (≥ 1280 px) o Clássico **continua visualmente igual**; a adaptação acontece abaixo disso.
2. Em celular o Clássico usa **um painel por vez** (abas), com o Console como padrão, em vez de tentar encolher três colunas.
3. A legenda "SWIPE UP" será **implementada** como gesto real (e não removida); se preferir remover, a F5 fica mais curta.
4. Navegadores-alvo: Chrome/Edge, Firefox e Safari em versões compatíveis com o Tailwind 4 (Safari 16.4+, Chrome 111+, Firefox 128+).
5. TV e quiosque ficam fora do escopo.
6. A escala fluida de fonte em telas grandes (≥ 1536 px) é **desejada**; pode ser desligada na F3 se a densidade atual for preferida.
