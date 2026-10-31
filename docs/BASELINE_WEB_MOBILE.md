# Baseline Web Mobile

Data coletados em 2026-10-31 antes das próximas correções do plano `NEXA Web Mobile`.

## Bundle de produção

`npm run build` (Vite 8.3.5) concluiu com sucesso e gerou estes chunks JavaScript:

| Chunk | Tamanho bruto | Gzip |
| --- | ---: | ---: |
| Entrada `index` | 617,26 kB | 187,95 kB |
| Clássico (lazy) | 84,04 kB | 22,37 kB |
| Ajustes (lazy) | 15,17 kB | 4,68 kB |
| Monitor (lazy) | 15,53 kB | 4,41 kB |
| Memória (lazy) | 14,03 kB | 3,59 kB |

O chunk inicial ultrapassa o orçamento indicativo de 200 kB gzip por 12,05 kB. O build avisa que o chunk de entrada supera 500 kB sem minificação.

## Depois da F2

Após mover o renderizador Markdown para um chunk sob demanda, o chunk principal ficou em 137,62 kB gzip. O conjunto carregado no HTML inicial (chunk principal e modulepreloads) mede **148,44 kB gzip**, validado por `npm run check:bundle`, com limite de 200 kB. A queda comparável do chunk principal é de 50,33 kB gzip.

## Causas confirmadas por inspeção do código

- As duas telas de fundo atualizam canvas continuamente, mesmo em aparelho compacto; cada quadro percorre pares de partículas.
- O HUD já limita o canvas a 20 partículas, reduz o DPR para 1,5 em compacto e pausa quando a página fica oculta ou movimento reduzido está ativo.
- A lista do chat usa `React.memo` nas bolhas e o stream já agrega tokens em janelas de 33 ms; as mensagens antigas continuam montadas e o markdown da resposta em andamento é reprocessado a cada flush.
- Ajustes, Monitor e Memória já usam `React.lazy`; Clássico também é carregado sob demanda em `App.tsx`.
- A autenticação usa campos com `text-base` (16 px em toque), safe area e contêiner rolável; viewport virtual já é compartilhado pelo HUD e Clássico.
- O Clássico tem fundos compactos sem backdrop-filter e lógica para pausar animações fora da tela/reduzir movimento.

## Não medido nesta sessão

INP, CLS, LCP, tarefas longas com CPU 4×, React Profiler, gravação em aparelhos reais, e validação de teclado em Safari iOS/Chrome Android exigem ferramentas ou dispositivos que não estão conectados a esta sessão. Os números de Web Vitals e fluidez real permanecem pendentes; não foram estimados.

## QA da F7

- Vitest: 77 testes passaram.
- Axe/Chromium: 12 cenários passaram em chat, Ajustes e Memória, nos viewports 320, 768 e 1280 px.
- Playwright responsivo: 19 passaram e 2 foram ignorados por serem exclusivos de ponteiro grosso; os 7 cenários WebKit não iniciaram porque este ambiente não tem as bibliotecas do sistema exigidas pelo WebKit.
- Build e orçamento do bundle passaram; JavaScript inicial: 148,44 kB gzip de 200 kB.
- O lint não iniciou a análise do código devido ao erro do ESLint instalado (`scopeManager.addGlobals is not a function`). O workflow CI usa Node 24 e reinstala dependências de forma limpa.
- Safari iOS, Android real e Web Vitals de campo ainda precisam de validação manual.
