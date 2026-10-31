# Guia de responsividade

Este guia descreve os padrões responsivos usados pela interface NEXA HUD.

## Regras de interface

1. Evite rolagem horizontal do documento entre 320 e 3840 px. Se um conteúdo precisar de largura extra, como uma tabela, coloque a rolagem no próprio componente.
2. Mantenha controles com pelo menos 44 × 44 px quando o ponteiro for grosso e nunca abaixo de 24 × 24 px.
3. Use texto informativo de pelo menos 12 px, rótulos decorativos de pelo menos 11 px e campos de 16 px em telas de toque. Prefira `rem` para dimensões e fontes.
4. Toda ação deve funcionar por toque ou teclado. Hover pode realçar controles, mas não pode ser o único meio de descobrir ou executar uma ação.
5. Em alturas de 320 px, permita rolagem interna e mantenha o controle ativo alcançável.
6. Respeite `--safe-top`, `--safe-right`, `--safe-bottom` e `--safe-left` ao fixar conteúdo perto das bordas.
7. Para controles fixos junto ao teclado virtual, use `--kb-inset`, atualizado por `useVisualViewport()`.
8. Não associe estado de conversa, rascunho ou aba a um componente que é desmontado ao mudar o viewport.
9. A interface deve continuar utilizável com zoom de navegador e reflow estreito. Não bloqueie o zoom no meta viewport.
10. Respeite `prefers-reduced-motion`; pause efeitos de canvas em abas ocultas e reduza o custo gráfico em telas compactas.

## Breakpoints e hooks

- `xs`: a partir de 30 rem (480 px).
- `sm`: 40 rem (640 px), `md`: 48 rem (768 px), `lg`: 64 rem (1024 px), `xl`: 80 rem (1280 px) e `2xl`: 96 rem (1536 px), conforme o tema Tailwind.
- `short`: altura máxima de 32 rem (512 px), usada sobretudo em celulares paisagem.

## Tokens de área segura e campos

Os tokens globais estão em `src/styles/index.css`:

```css
--safe-top: env(safe-area-inset-top, 0px);
--safe-right: env(safe-area-inset-right, 0px);
--safe-bottom: env(safe-area-inset-bottom, 0px);
--safe-left: env(safe-area-inset-left, 0px);
--kb-inset: 0px;
```

Use `nexa-field` nos campos de formulário. Ele estabelece altura mínima de 44 px e 16 px em ponteiro grosso. Não use `maximum-scale` no viewport.

## Conteúdo rolável

- Aplique `min-width: 0` aos filhos de flex/grid que contêm texto ou mídia.
- Use `overflow-x-auto` localmente para tabelas e blocos de código largos.
- Em Markdown, permita que URLs longas quebrem com `overflow-wrap: anywhere`; imagens devem ter `max-width: 100%` e `height: auto`.
- Diálogos e folhas devem limitar a altura a `100dvh` e rolar o conteúdo dentro da própria superfície.
- Elementos decorativos, como canvas e glows, devem usar `pointer-events: none`.

## Desempenho e navegação em camadas

- Em telas touch, o fundo do HUD mantém o gradiente estático e pausa o canvas. A animação só roda em ponteiro fino e para ao ocultar a aba ou ativar movimento reduzido.
- A resposta em streaming agrega tokens antes de atualizar a lista. As mensagens usam `React.memo`, conteúdo Markdown separado em chunk lazy, `useDeferredValue` e `content-visibility: auto` nas linhas antigas.
- Ajustes, Monitor, Memória e Markdown são carregados sob demanda; falha de download de um chunk mostra uma ação para tentar de novo.
- O drawer de conversas e o painel móvel do núcleo fecham com Escape ou Voltar do navegador.
- Mensagens antigas deixam de acompanhar automaticamente o streaming quando a pessoa rola para cima; o botão **Ir para o fim** retorna à resposta recente.

O chunk principal medido antes destas otimizações foi 187,95 KB gzip; após separar Markdown, o conjunto de JavaScript inicial (entrada mais modulepreloads) ficou em 148,44 KB gzip, abaixo do limite de 200 KB. Consulte o [baseline detalhado](BASELINE_WEB_MOBILE.md). Esses valores são do build local, não substituem Web Vitals em aparelhos reais.

## Verificação

Execute `npm run test:responsive` para a matriz responsiva Playwright em Chromium, Chromium com toque (Pixel 7), Firefox e WebKit. O Playwright e os navegadores precisam estar instalados (`npx playwright install --with-deps chromium firefox webkit`). O teste cobre larguras de 320 a 3840 px, paisagem baixa, rolagem horizontal, alvos de toque, campos com fonte legível e preservação do rascunho/aba durante rotação.

Os testes axe executam em Chromium nas larguras de 320, 768 e 1280 px. O workflow `Web mobile quality` roda a matriz responsiva, axe e Lighthouse CI com limites para performance, acessibilidade, LCP, CLS e JavaScript inicial.

### Checklist para PR

- [ ] Verifiquei 320, 390, 768, 1280 e 1920 px, incluindo paisagem baixa.
- [ ] Verifiquei foco e interação por toque, mouse e teclado.
- [ ] Verifiquei o campo ativo com o teclado virtual aberto.
- [ ] Não há rolagem horizontal do documento nem controles abaixo do mínimo de toque.
- [ ] Mudança de breakpoint/rotação preserva conversa, rascunho e aba ativa.
- [ ] Efeitos respeitam `prefers-reduced-motion` e não continuam em abas ocultas.
- [ ] Rodei `npm run test:responsive` ou registrei o motivo da impossibilidade.
- [ ] Conferi o relatório Lighthouse CI e não ultrapassei os orçamentos de Web Vitals e JavaScript.
