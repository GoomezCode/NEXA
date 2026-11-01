# Design system do front-end

Este documento descreve os componentes e temas que existem no NEXA Web. Os estilos globais e tokens vivem em `src/styles/tokens.css` e `src/styles/index.css`; os componentes reutilizáveis ficam em `src/components/ui/`.

## Temas

O tema é persistido em `settings-store` e aplicado como `data-theme` no elemento `<html>`. Os valores aceitos são `hud` (padrão), `violet`, `rose`, `classic`, `light` e `contrast`. A opção `classic` é apenas uma paleta da interface NEXA atual; não carrega uma segunda aplicação.

Os temas substituem os tokens semânticos de fundo, superfície, texto, borda e cor primária. Componentes devem preferir esses tokens (`bg-surface`, `text-foreground`, `border-border`, `text-primary`) a cores fixas para acompanhar a troca de paleta.

## Primitivos compartilhados

| Componente | Uso |
|---|---|
| `Button` | Ações com variantes e dimensões comuns. |
| `Badge` | Estado e rótulos curtos. |
| `Field` | Campo de formulário com label e estados acessíveis. |
| `Panel` | Superfície com título, ícone e região nomeada. |
| `Skeleton` | Estado de carregamento sem conteúdo falso. |
| `Switch` | Preferência booleana com semântica de controle. |

Use `cn` de `src/lib/utils.ts` para combinar classes. Campos de toque devem manter altura mínima de 44 px; os estilos globais reforçam esse piso em dispositivos com ponteiro grosso.

## Rotas e carregamento

O `BrowserRouter` envolve a aplicação. Chat, memória, monitor e ajustes usam caminhos próprios (`/`, `/c/:id`, `/memory`, `/monitor` e `/settings`). As telas de memória, monitor e ajustes são carregadas sob demanda. Ao adicionar uma tela, mantenha o caminho navegável por link e o fallback de chunk em `ChunkLoadBoundary`.

## Formulários

Formulários de autenticação, perfil, memórias e credenciais de provedores usam React Hook Form com Zod. Schemas vivem junto ao domínio que os valida; erros do servidor são mapeados para o campo correspondente e erros gerais ficam visíveis no formulário. O formulário de Ollama continua como controles de configuração direta, sem submissão de credenciais.

## Referências de código

- Tokens e paletas: `src/styles/tokens.css`.
- Componentes base: `src/components/ui/`.
- Estado das preferências: `src/stores/settings-store.ts`.
- Aplicação dos atributos de tema e efeitos: `src/app/App.tsx`.
