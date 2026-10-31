# NEXA Web Mobile — Plano de correção e polimento

> Complementa `docs/PLANO_RESPONSIVIDADE.md`. Escopo: somente a Web (HUD e Clássico). A API não muda. Este plano foi montado a partir das medições e dos achados do plano de responsividade. Eu ainda não li o código-fonte: a Fase 0 confirma as causas com medição antes de reescrever qualquer coisa.

## 1. Resumo

Os sintomas relatados (travando, lento, coisas que não abrem, conteúdo fora da tela, visual ruim) vêm de quatro famílias de causa. O plano de responsividade já cobre bem o layout e o tamanho dos alvos de toque. Este plano acrescenta o que falta: desempenho em aparelho modesto, sobreposições que abrem e fecham de forma confiável, uma camada visual coesa e interações pensadas para toque.

| Sintoma | Causa provável | Origem |
| --- | --- | --- |
| Interface travando e lenta | Canvas de partículas com custo O(n²) e sem pausa; `backdrop-blur` em muitas camadas; animações infinitas dos anéis do núcleo | Medido no plano de responsividade (C10) |
| Interface travando durante a resposta | A lista inteira e o markdown são reprocessados a cada pedaço de texto do streaming; Motion carregado por completo; bundle inicial grande | Hipótese minha, a validar na F0 |
| Coisas não abrem | Clássico bloqueado abaixo de 1024 px; sobreposições sem controle de foco e rolagem; botão voltar do sistema não fecha nada; botão fixo sobreposto (C3, C5, C6) | Medido e hipótese |
| Fora da tela ou cortado | Login sem rolagem em paisagem (bug crítico); layout fixo do Clássico; teclado cobrindo o campo; safe-area (C6, C11) | Medido |
| Feio e confuso | Textos de 7 a 11 px, alvos pequenos, funções só por hover, muitos efeitos competindo, hierarquia fraca (C7, C8, C9) | Medido |

## 2. Metas medíveis

Valores indicativos, ajustados depois do baseline da F0.

| Meta | Como medir |
| --- | --- |
| Rolagem do chat fluida durante streaming, em Android intermediário | Chrome Performance com CPU 4× mais lenta |
| INP abaixo de 200 ms; CLS abaixo de 0,1; LCP abaixo de 2,5 s em 4G simulado | `web-vitals` e Lighthouse |
| JavaScript inicial menor, com Clássico, Ajustes, Monitor e Memória carregados sob demanda (meta indicativa: abaixo de 200 KB gzip) | `rollup-plugin-visualizer` |
| Todo toque mostra reação visual em menos de 100 ms | Revisão e teste manual |
| Todo painel e diálogo abre e fecha por toque, arrastar, Esc e botão voltar | Playwright e aparelho real |
| Nada fora da tela de 320 a 1920 px | Regras R1 a R9 do plano de responsividade |

## 3. Bibliotecas

Princípio: manter a stack atual (React 19, Tailwind 4, Zustand, Motion) e adicionar só o que resolve um problema real. Preferir bibliotecas sem estilo próprio (headless), que herdam o visual do Tailwind.

### Adotar

| Biblioteca | Para quê |
| --- | --- |
| Radix UI (ou shadcn/ui, que usa Radix com Tailwind 4; copiar só os componentes necessários) | Dialog, Tabs, DropdownMenu, Popover, Tooltip e ScrollArea com foco, trava de rolagem, Esc e ARIA prontos. Resolve “não abre” e “não fecha” |
| Vaul | Bottom sheet com arrastar para fechar, nativo ao toque: conversas, painel do núcleo, apps, Ajustes no celular |
| Sonner | Toasts empilháveis, com deslize para dispensar e safe-area. Substitui o `NotificationSystem` |
| Lucide React | Ícones consistentes (manter se já é usado) |
| `web-vitals`, Lighthouse CI, `rollup-plugin-visualizer` | Medir desempenho e tamanho, e barrar regressão no CI |
| `react-virtuoso` (ou `@tanstack/react-virtual`) | Virtualizar a lista de mensagens, **só se** o Profiler mostrar custo em conversas longas |

### Usar melhor o que já existe

- **Motion:** `LazyMotion` com `domAnimation`; animar só `transform` e `opacity`; `MotionConfig reducedMotion="user"`; usar `drag` do próprio Motion para o gesto “SWIPE UP” (sem dependência nova).
- **Zustand:** seletores finos com `useShallow`; estado de streaming separado do resto.
- **React 19:** `useDeferredValue` e `startTransition` para o conteúdo que chega em streaming.

### Não adotar

- MUI, Chakra, Ant Design, Bootstrap: pesados, brigam com o Tailwind e obrigariam a redesenhar tudo.
- Bibliotecas de partículas (por exemplo tsparticles): o fundo precisa ficar mais leve, não mais rico.
- GSAP e react-spring: o Motion já cobre.

Cada dependência nova entra com o tamanho medido no bundle e uma justificativa no PR.

## 4. Direção visual e de navegação

A identidade do NEXA (paleta, tipografia, estética de HUD) é mantida. Muda a disposição, o espaçamento, a hierarquia e a quantidade de efeitos.

1. **Uma coisa por vez na tela:** um painel ativo, com a conversa como foco.
2. **Hierarquia de texto em três níveis:** título, corpo (16 px) e apoio (12 px). Nada abaixo de 11 px.
3. **Espaçamento em escala de 4 e 8 px**, mais respiro e menos bordas.
4. **Efeitos de HUD só como acento:** em celular, fundo sólido semitransparente em vez de `backdrop-filter`, e brilho apenas no elemento ativo.
5. **Cinco estados em todo controle:** normal, pressionado, foco visível, desabilitado e carregando.
6. **Polegar primeiro:** ações principais na metade de baixo (barra inferior, campo de mensagem, sheets que sobem de baixo).
7. **Estados vazios, de carregamento (skeleton) e de erro** com texto claro e ação (“Tentar de novo”).
8. **Movimento curto** (150 a 250 ms), reduzido quando o sistema pede.

**Navegação no celular**

- Barra inferior com os destinos atuais do HUD (Chat, Memória, Monitor, Ajustes), com rótulo visível.
- Cabeçalho enxuto: conversas, título, troca HUD ↔ Clássico (hoje some abaixo de 640 px) e notificações.
- Sheets (Vaul) para conversas, painel do núcleo e apps; Dialog (Radix) para confirmações.
- Botão voltar do sistema fecha a camada mais alta.

## 5. Fases

Ordem: `F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7`. Este plano define a **ordem de execução**; o conteúdo técnico do plano de responsividade continua valendo e é reaproveitado nas fases abaixo.

### F0 — Diagnóstico e baseline (≈ 1 dia)

- [ ] Reproduzir os bugs em aparelho real: Android via `chrome://inspect`; iPhone com Safari Web Inspector, se houver um Mac. Gravar a tela dos 5 piores fluxos.
- [ ] Perfilar com Chrome Performance (CPU 4×) e React Profiler: login, chat, resposta em streaming, abrir Ajustes e Monitor, trocar para o Clássico. Anotar tarefas longas e o que as causa.
- [ ] Medir bundle e Web Vitals no celular simulado.
- [ ] Executar a F0 do plano de responsividade (testes e snapshots de desktop).

**Pronto quando:** existe uma lista priorizada de causas **medidas** (não suspeitas), com o baseline em números.

### F1 — Estancar o sangramento (≈ 2 dias)

Maior ganho por esforço.

- [ ] Login e Cadastro com rolagem em qualquer altura (F2 do plano de responsividade).
- [ ] Campos com 16 px em toque, `h-dvh`, safe-area, `touch-action: manipulation`, correção de rolagem horizontal.
- [ ] Canvas de fundo: `devicePixelRatio` até 2, menos partículas, pausa em `visibilitychange` e em `prefers-reduced-motion`; em celular, gradiente estático como alternativa.
- [ ] `backdrop-filter` desligado em telas compactas.
- [ ] Animações infinitas do núcleo pausadas quando fora da tela.
- [ ] Botão do painel do núcleo sai do `fixed bottom-20`.
- [ ] Clássico abaixo de 1024 px: enquanto o layout compacto não existe (F6), trocar o aviso “continuar mesmo assim” por redirecionamento claro ao HUD, para não entregar uma tela quebrada.

**Pronto quando:** nada fica cortado nos fluxos principais e a rolagem do chat está fluida com CPU 4× mais lenta.

### F2 — Desempenho do chat e do bundle (≈ 2 dias)

- [ ] **Streaming:** juntar os pedaços de texto em um buffer e aplicar no estado a cada frame (ou a cada 50 a 80 ms), e não a cada chunk.
- [ ] **Mensagens:** `React.memo` em `MessageBubble`; mensagens concluídas imutáveis; só a última re-renderiza; `useDeferredValue` no conteúdo em andamento.
- [ ] **Markdown:** evitar reprocessar o texto inteiro a cada token (processar por blocos ou avaliar uma biblioteca de markdown para streaming).
- [ ] **Zustand:** seletores finos e `useShallow`.
- [ ] **Lista:** `content-visibility: auto` com `contain-intrinsic-size` nas mensagens antigas; virtualização só se o perfil justificar.
- [ ] **Divisão de código:** `React.lazy` e `Suspense` para Clássico, Ajustes, Monitor, Memória e o realce de código do markdown; `manualChunks` para vendors; tentar de novo se um chunk falhar na rede ruim.
- [ ] **Motion:** `LazyMotion`; remover animações de `layout` em listas grandes.
- [ ] **Fontes:** hospedar localmente, subconjunto, `font-display: swap`, preload da principal.

**Pronto quando:** o bundle inicial caiu (valor registrado), não há tarefas longas acima de 50 ms ao digitar e durante o streaming, e o INP fica abaixo de 200 ms.

### F3 — Navegação e sobreposições confiáveis (≈ 2 dias)

- [ ] Instalar Radix (ou shadcn) e Vaul; criar `components/ui/` com Sheet, Dialog, Tabs, Menu e Toast (Sonner) estilizados com os tokens do projeto.
- [ ] Migrar uma sobreposição por vez: `SessionsSheet`, painel do núcleo, `NotificationCenter`, Ajustes e diálogos de confirmação. O Clássico migra na F6.
- [ ] Hook `useOverlayHistory()`: ao abrir uma camada, empurra um estado no histórico; o botão voltar fecha a camada.
- [ ] Escala central de `z-index` e um único portal; fim das camadas concorrentes.
- [ ] Barra inferior de navegação no compacto, cabeçalho enxuto e atalho HUD ↔ Clássico visível (C5).
- [ ] `useVisualViewport()` para o teclado virtual (D6 do plano de responsividade).

**Pronto quando:** todo painel abre e fecha por toque, arrastar, Esc e voltar; o foco retorna ao gatilho; nenhuma camada compete com outra, inclusive em paisagem e com teclado aberto.

### F4 — Sistema visual mobile (≈ 2 dias)

- [ ] Tokens (D3 do plano de responsividade) mais escala de espaçamento, raios, elevação e cores semânticas (sucesso, erro, aviso) com contraste AA.
- [ ] Componentes base: Button, Input (`nexa-field`), Chip, Card, ListItem, Skeleton, EmptyState e Spinner.
- [ ] Aplicar no HUD: chat (balões, composer, cabeçalho), Memória, Monitor e Ajustes, com texto mínimo, alvos de 44 px e hierarquia clara.
- [ ] Monitor e Memória em cartões empilhados com `@container`.
- [ ] Comparação antes e depois em 390×844 e 360×740, para sua aprovação tela por tela.

**Pronto quando:** cada tela do HUD foi aprovada em 390×844 e em 320×568.

### F5 — Interatividade e microfeedback (≈ 1,5 dia)

- [ ] Estado pressionado imediato em todo controle (`active:` com transição curta).
- [ ] Envio otimista (a mensagem aparece na hora), indicador de “pensando”, botão de parar durante o streaming e repetir em caso de erro.
- [ ] Botão “ir para o fim” quando a conversa foi rolada para cima.
- [ ] Gestos: arrastar sheet para fechar (Vaul); deslizar o dock para cima (Motion `drag`) ou remover a legenda “SWIPE UP”.
- [ ] Opcionais, se você quiser: deslizar uma conversa para arquivar ou excluir; copiar mensagem com toque longo; vibração leve em ações importantes (a Vibration API funciona no Android, não no Safari do iPhone).

**Pronto quando:** nenhuma ação fica sem retorno visual e os gestos funcionam em aparelho real.

### F6 — Clássico no celular (≈ 5 dias)

Executar a F4 e a F5 do plano de responsividade (quatro layouts, tokens `--c-*`, componentes um a um), usando os componentes de F3 e F4 (Sheet, Toast, Button) em vez de reescrever as sobreposições do zero. Se o prazo apertar, o HUD fica como padrão no celular e o Clássico compacto entra depois, sem atrasar o resto.

**Pronto quando:** o Clássico abre em 320 px sem aviso de bloqueio, sem perder a conversa ao girar a tela, e os snapshots de desktop continuam iguais.

### F7 — Testes, QA e CI (≈ 2 dias)

- [ ] Projetos móveis do Playwright e helpers das regras R1 a R5 (seção 5 do plano de responsividade).
- [ ] Fluxo e2e: login, enviar mensagem, streaming, girar a tela, abrir e fechar cada sheet, trocar HUD ↔ Clássico.
- [ ] Lighthouse CI com orçamento de desempenho: o PR falha se o bundle ou os Web Vitals estourarem.
- [ ] axe-core em 320, 768 e 1280 px.
- [ ] Checklist manual em aparelho real (seção 7 do plano de responsividade).
- [ ] README e `docs/GUIA_RESPONSIVIDADE.md` atualizados.

## 6. Cronograma (indicativo, uma pessoa)

| Fase | Entrega | Dias | Acumulado |
| --- | --- | --: | --: |
| F0 | Diagnóstico e baseline | 1 | 1 |
| F1 | Estancar: sem cortes, sem travar | 2 | 3 |
| F2 | Desempenho do chat e do bundle | 2 | 5 |
| F3 | Navegação e sobreposições | 2 | 7 |
| F4 | Sistema visual mobile | 2 | 9 |
| F5 | Interatividade | 1,5 | 10,5 |
| F6 | Clássico no celular | 5 | 15,5 |
| F7 | Testes, QA e CI | 2 | 17,5 |

**Marcos úteis**

- **Fim da F1 (≈ 3 dias):** o HUD no celular deixa de cortar e de travar nos fluxos principais.
- **Fim da F3 (≈ 7 dias):** tudo abre e fecha de forma previsível.
- **Fim da F5 (≈ 10 dias):** HUD mobile limpo, rápido e interativo.
- **Fim da F7:** Clássico incluso, com testes e CI.

## 7. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Otimizar o que não é o gargalo | F0 mede antes; só entra o que o perfil confirma |
| Trocar sobreposições muda o comportamento | Migrar uma por vez, com teste e2e por sobreposição |
| Radix e Vaul têm particularidades no Safari do iPhone (trava de rolagem, teclado) | Testar em iPhone real desde a F3 |
| Dependências novas aumentam o bundle | Medir cada uma, justificar no PR e carregar sob demanda |
| Regressão visual no desktop | Snapshots da F0 em cada PR |
| Visual é subjetivo e pode gerar retrabalho | Aprovação tela por tela na F4 |
| Chunk carregado sob demanda falha em rede ruim | Fallback com botão de tentar de novo |

## 8. Definição de pronto

- [ ] Nenhum item fora da tela e nenhuma rolagem horizontal de 320 a 1920 px, em HUD e Clássico.
- [ ] Chat fluido durante streaming em CPU 4× mais lenta; INP abaixo de 200 ms.
- [ ] Todo painel, sheet e diálogo abre e fecha por toque, arrastar, Esc e botão voltar.
- [ ] Nenhuma função depende só de hover; “SWIPE UP” funciona ou foi removido.
- [ ] Textos com no mínimo 11 px (informativos 12 px), campos com 16 px em toque e alvos de 44 px.
- [ ] No iPhone, o foco nos campos não dá zoom e o teclado não cobre o campo ativo.
- [ ] Girar a tela durante o streaming não perde mensagem, rascunho nem aba ativa.
- [ ] Desktop (1280 px ou mais) igual ao baseline, salvo diferenças aprovadas.
- [ ] `npm run check`, `test:e2e` e `test:responsive` verdes; Lighthouse CI e axe sem violações.
- [ ] Checklist manual executado em pelo menos um iPhone, um Android e um iPad.

## 9. Suposições (avise se alguma estiver errada)

1. A identidade visual do NEXA é mantida; muda a organização, não a marca.
2. Radix (ou shadcn), Vaul e Sonner são aceitos como novas dependências.
3. No celular, o HUD é o padrão; o Clássico compacto chega na F6.
4. As metas numéricas são indicativas e serão ajustadas com o baseline da F0.
5. Existe pelo menos um Android real para testar (ideal: um iPhone também).
6. As causas listadas na seção 1 como “hipótese” ainda não foram medidas.
