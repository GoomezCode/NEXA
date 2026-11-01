# NEXA Web

Interface conversacional da NEXA, construída com React, TypeScript e Vite. Pode usar a API NEXA, o adaptador de demonstração ou modelos locais executados pelo Ollama.

## Conteúdo

- [Recursos](#recursos)
- [Requisitos](#requisitos)
- [Início rápido](#início-rápido)
- [Modo offline com Ollama](#modo-offline-com-ollama)
- [Compatibilidade](#compatibilidade)
- [Configuração](#configuração)
- [Comandos](#comandos)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Documentação](#documentação)
- [Guia de arquitetura e manutenção](docs/GUIA_ARQUITETURA_FRONTEND.md)

## Recursos

- Chat com streaming, cancelamento, nova tentativa e histórico local em IndexedDB.
- Autenticação por conta ou convidado quando conectado à API NEXA.
- Modo demonstração local para explorar a interface sem a API.
- Modo OFFLINE com Ollama local, catálogo de modelos instalados e streaming NDJSON.
- Memórias locais, personalização, entrada por voz e leitura opcional das respostas.
- Interface NEXA HUD responsiva, com rotas de chat, memória, monitoramento e ajustes.
- Seis temas de interface, modos de efeitos visuais e formulários com validação acessível.
- Destaque de blocos de código carregado sob demanda e visualizações de carregamento compartilhadas.

## Requisitos

- Node.js 24 ou superior.
- npm 11 ou superior.
- Ollama instalado e com pelo menos um modelo baixado para usar o modo OFFLINE.

## Início rápido

```bash
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:5173`. Para expor a interface na rede local:

```bash
npm run dev -- --host
```

Acesse pelo endereço de rede mostrado pelo Vite, por exemplo `http://192.168.1.20:5173`. Se o firewall do computador bloquear conexões de entrada, permita o acesso à porta do Vite na rede local.

O servidor de desenvolvimento não possui autenticação de rede. Dispositivos que alcançam a porta do Vite também podem usar o proxy local do Ollama; use essa opção apenas em uma rede confiável.

## Modo offline com Ollama

O modo OFFLINE não exige conta nem API NEXA. Ele usa somente modelos locais instalados no Ollama; o histórico fica no navegador e separado do histórico da API.

1. Inicie o Ollama no mesmo computador que executa o Vite:

   ```bash
   ollama serve
   ollama pull llama3.1
   ```

2. Inicie a Web com `npm run dev -- --host` se for acessá-la por outro dispositivo da rede.
3. Na tela de acesso, escolha **OFFLINE**. Em Ajustes, a URL do Ollama deve estar como `/ollama`.

O Vite encaminha as chamadas de `/ollama/api/...` para `127.0.0.1:11434` no computador que está executando o servidor Web. O navegador conversa apenas com a origem da Web; o Ollama não precisa ser exposto na rede nem aceitar a origem do navegador. O proxy remove o cabeçalho `Origin` antes de encaminhar a requisição.

Essa configuração funciona com `npm run dev` e `npm run preview`. Para uma hospedagem estática, configure um proxy reverso same-origin no servidor ou ajuste o CORS do Ollama para a origem hospedada. A interface deve ser aberta por uma origem alcançável pelo dispositivo cliente.

O catálogo exclui modelos remotos e modelos identificados como exclusivos de embeddings. **Automático** seleciona o modelo conversacional local mais recente. A primeira resposta pode levar alguns minutos enquanto o Ollama carrega o modelo. Se não houver modelos, execute `ollama pull <modelo>`.

Para sair, use **Sair do offline** no cabeçalho ou em Ajustes. Conversas e memórias ficam armazenadas localmente no navegador; limpar os dados do site remove esse conteúdo. O modo não inclui imagens, ferramentas, sincronização com a API ou instalação de modelos pela interface.

### Diagnóstico rápido

| Sintoma                              | Ação                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Ollama indisponível                  | Confirme que `ollama serve` está ativo no computador que roda o Vite.                    |
| HTTP 403                             | Confirme URL `/ollama` e reinicie o Vite após alterações em `vite.config.ts`.            |
| Nenhum modelo listado                | Baixe um modelo conversacional com `ollama pull <modelo>`.                               |
| A Web não abre por outro dispositivo | Use `npm run dev -- --host` e verifique o firewall e a porta 5173.                       |
| A conexão direta apresenta CORS      | Use `/ollama`; não configure `http://localhost:11434` no navegador de outro dispositivo. |

## Compatibilidade

A interface NEXA HUD adapta-se a celulares, tablets, notebooks, desktops e telas grandes. Chat, memória, monitoramento e ajustes têm URLs próprias e acompanham o histórico do navegador. A base de navegadores do projeto segue os requisitos do Tailwind 4: Safari 16.4+, Chrome/Edge 111+ e Firefox 128+. O layout compacto inclui navegação por abas, suporte a toque, safe areas e teclado virtual; use zoom do navegador sem restrição.

Para validar tamanhos de tela e rotação nos três motores, instale os navegadores Playwright e execute:

```bash
npx playwright install --with-deps chromium firefox webkit
npm run test:responsive
```

Essa verificação automatizada não substitui a checagem de Safari iOS, Android e dispositivos com notch e teclado real.

## Configuração

As variáveis do frontend são lidas pelo Vite no início do processo. Reinicie o Vite depois de alterá-las.

| Variável                    | Padrão                   | Uso                                                                |
| --------------------------- | ------------------------ | ------------------------------------------------------------------ |
| `VITE_API_URL`              | `/api/v1`                | Base da API NEXA.                                                  |
| `VITE_API_PROXY`            | `http://localhost:8000`  | Destino local do proxy da API durante desenvolvimento.             |
| `VITE_DEMO_MODE`            | `false`                  | Usa respostas locais simuladas quando ativado.                     |
| `VITE_REGISTRATION_ENABLED` | `false`                  | Exibe a opção de cadastro; a API também precisa permitir cadastro. |
| `VITE_OLLAMA_URL`           | `/ollama`                | URL usada pelo cliente Ollama. Prefira o proxy same-origin.        |
| `VITE_OLLAMA_PROXY`         | `http://127.0.0.1:11434` | Destino do proxy Vite para o Ollama.                               |
| `VITE_OLLAMA_NUM_CTX`       | `4096`                   | Janela de contexto enviada ao Ollama.                              |

As configurações também podem ser ajustadas pela interface. O modo de conexão e as preferências são persistidos no navegador.

Para conectar à API real, configure `VITE_DEMO_MODE=false` e aponte `VITE_API_URL` para a API. O cadastro depende de `VITE_REGISTRATION_ENABLED=true` na Web e `ALLOW_SELF_REGISTRATION=true` na API. Chaves BYOK são armazenadas e cifradas pelo backend; a chave de criptografia deve ser configurada somente na API.

## Comandos

| Comando                   | Descrição                                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`             | Inicia o servidor de desenvolvimento.                                  |
| `npm run dev -- --host`   | Inicia o servidor acessível pela rede local.                           |
| `npm run build`           | Verifica tipos e cria o build em `dist/`.                              |
| `npm run check:bundle`    | Verifica se o JavaScript inicial gzip permanece abaixo de 200 kB.      |
| `npm run preview`         | Serve localmente o build, incluindo o proxy local configurado no Vite. |
| `npm run lint`            | Executa o ESLint.                                                      |
| `npm run typecheck`       | Verifica os tipos TypeScript.                                          |
| `npm test`                | Executa os testes unitários com Vitest.                                |
| `npm run test:e2e`        | Executa os testes end-to-end com Playwright.                           |
| `npm run test:responsive` | Executa a matriz responsiva Chromium, Firefox e WebKit.                |
| `npm run check`           | Executa lint, tipos, testes e build.                                   |

## Estrutura do projeto

```text
src/
├── api/          Clientes HTTP/Ollama, adaptadores e persistência
├── app/          Composição da aplicação e providers
├── components/   Componentes compartilhados
├── features/     Autenticação, chat, monitor, memória e ajustes
├── hooks/        Hooks compartilhados
├── stores/       Estado persistido e estado de interface
└── styles/       Tokens e estilos globais
docs/             Planos técnicos e notas de implementação
e2e/              Cenários Playwright
tests/            Testes unitários e de componentes
```

## Documentação

- [Guia de arquitetura e manutenção do front-end](docs/GUIA_ARQUITETURA_FRONTEND.md)
- [Design system do front-end](docs/FRONTEND_DESIGN_SYSTEM.md)
- [Guia de efeitos visuais](docs/GUIA_EFEITOS_VISUAIS.md)
