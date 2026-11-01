# Guia de efeitos visuais

O modo de efeitos controla intensidade visual sem alterar o conteúdo ou as funções da interface. A preferência fica em Ajustes → Aparência e é aplicada em `data-fx` no elemento `<html>`.

## Modos disponíveis

| Preferência | Comportamento |
|---|---|
| Automático | Usa `lite` se o sistema pede movimento reduzido, o usuário ativou “Reduzir animações”, o aparelho informa até 4 GB de memória ou até 4 processadores, ou a conexão ativa `saveData`. Nos demais casos usa `balanced`. |
| Completo | Mantém os efeitos visuais; preferência de movimento reduzido ainda força `lite`. |
| Equilibrado | Usa blur moderado e animações discretas. |
| Econômico | Remove blur e animações decorativas e suspende o canvas de fundo. |

“Reduzir animações” tem precedência sobre todos os modos. Mudanças na preferência do sistema e no estado de economia de dados são observadas enquanto a aplicação está aberta.

## Implementação atual

- `src/app/App.tsx` calcula o atributo `data-fx` e também publica `data-reduced-motion`.
- `src/styles/index.css` limita blur, pulsos, rotações e transições conforme o modo.
- `BackgroundCanvas` pausa em movimento reduzido, aba oculta ou modo econômico; em dispositivos de toque também mantém o canvas parado.
- Aurora e spotlight só animam/atualizam em ponteiro fino. O spotlight escreve propriedades CSS via `requestAnimationFrame`.
- A transição entre rotas e a entrada de mensagens usam CSS para evitar colocar a biblioteca Motion no chunk inicial. Motion continua isolado na carta de API, carregada pela tela Monitor.
- Estados de carregamento usam o primitivo `Skeleton` compartilhado.

## Limites e validação

O modo automático usa capacidades informadas pelo navegador; ele não mede FPS nem faz benchmark contínuo. `deviceMemory` não está disponível em todos os navegadores, então a decisão usa apenas os sinais existentes. `lite` reduz efeitos, mas não substitui a preferência explícita de acessibilidade do sistema.

Ao adicionar um efeito, prefira `transform` e `opacity`, respeite `data-fx='lite'` e `prefers-reduced-motion`, e evite animação contínua em toque. Verifique o orçamento do JavaScript inicial com `npm run check:bundle`; efeitos CSS não devem exigir dependências novas no chunk inicial.
