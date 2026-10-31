# Documentação da NEXA Web

Este diretório reúne planos técnicos e registros de implementação. O README da raiz é o guia de instalação e operação; os planos abaixo documentam arquitetura, histórico e itens de fechamento.

## Estado atual

| Área | Estado resumido | Documento |
|---|---|---|
| Aplicação e operação local | HUD/Clássico, API, demonstração e modo OFFLINE com Ollama | [README principal](../README.md) |
| Modo OFFLINE e acesso pela rede local | Implementado com proxy same-origin do Vite para evitar CORS; testes dedicados e validação manual com Ollama real ainda são pendentes | [Plano do Ollama](PLANO_MODO_OFFLINE_OLLAMA.md) |
| Integração com a API | Chat, autenticação, modelos, cotas e integrações documentados; fechamento de release permanece separado | [Plano de integração](PLANO_INTEGRACAO_NEXA_API.md) |
| Autenticação | Login, convidado, cadastro por configuração e ciclo de sessão implementados | [Plano de autenticação](PLANO_CORRECAO_AUTENTICACAO.md) |
| Responsividade e desempenho mobile | Canvas estático em touch, chunks sob demanda, retorno do navegador para camadas e CI de Lighthouse/axe; WebKit depende das bibliotecas do sistema no ambiente local | [Guia de responsividade](GUIA_RESPONSIVIDADE.md) · [Baseline de desempenho](BASELINE_WEB_MOBILE.md) · [Plano](PLANO_RESPONSIVIDADE.md) |
| Planejamento API + Web | Análise inicial e decisões de implementação; parte do diagnóstico é histórica | [Plano geral](NEXA%20%E2%80%94%20Plano%20de%20implementa%C3%A7%C3%A3o%20(API%20%2B%20Web).md) |

## Como interpretar os planos

Os planos preservam diagnóstico, decisões e critérios de aceite. Quando o diagnóstico inicial divergir do código atual, consulte primeiro a seção **Estado atual** de cada documento e depois o README principal. Os itens marcados como pendentes são trabalho em aberto; uma estimativa original não representa prazo comprometido.

## Ambiente local e rede

Para abrir a Web em outro dispositivo da mesma rede, use `npm run dev -- --host`. O proxy `/ollama` executa no computador que hospeda o Vite e encaminha as requisições ao Ollama local em `127.0.0.1:11434`. O navegador usa a mesma origem da Web e não precisa acessar diretamente a porta do Ollama.
