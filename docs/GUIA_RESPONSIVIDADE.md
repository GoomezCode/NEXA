# Guia de responsividade

Este guia descreve os padrões usados pelo HUD e pelo modo Clássico. A adaptação visual é feita principalmente em CSS; `useLayoutClass()` só deve decidir mudanças estruturais entre layouts.

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
- `useLayoutClass()` retorna `compact`, `medium` ou `expanded` e informa se a altura é curta. Use-o quando a árvore precisar mudar; prefira variantes CSS para ajustes de tamanho e espaçamento.

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

## Verificação

Execute `npm run test:responsive` para a matriz responsiva Playwright em Chromium, Chromium com toque (Pixel 7), Firefox e WebKit. O Playwright e os navegadores precisam estar instalados (`npx playwright install --with-deps chromium firefox webkit`). O teste cobre larguras de 320 a 3840 px, paisagem baixa, rolagem horizontal, alvos de toque, campos com fonte legível e preservação do rascunho/aba durante rotação.

### Checklist para PR

- [ ] Verifiquei 320, 390, 768, 1280 e 1920 px, incluindo paisagem baixa.
- [ ] Verifiquei foco e interação por toque, mouse e teclado.
- [ ] Verifiquei o campo ativo com o teclado virtual aberto.
- [ ] Não há rolagem horizontal do documento nem controles abaixo do mínimo de toque.
- [ ] Mudança de breakpoint/rotação preserva conversa, rascunho e aba ativa.
- [ ] Efeitos respeitam `prefers-reduced-motion` e não continuam em abas ocultas.
- [ ] Rodei `npm run test:responsive` ou registrei o motivo da impossibilidade.
