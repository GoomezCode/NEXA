# NEXA local voice service

Serviço local de reconhecimento de fala. O áudio é recebido em memória e não é salvo em disco; o modelo Whisper é baixado uma vez para `models/`.

## Primeira configuração

Instale Python 3 e execute uma vez na raiz do projeto:

```sh
npm run voice:setup
```

O comando cria `voice-server/.venv` e instala as dependências. Depois disso, o serviço inicia automaticamente junto com a aplicação ao executar `npm run dev` e encerra junto com ela.

O serviço usa por padrão o modelo `small` em CPU, com busca mais precisa (`beam_size=5`); isso consome mais memória e leva mais tempo que o perfil `base`. Se preferir velocidade, configure `WHISPER_MODEL=base` antes de iniciar a web. Para configurar antes de iniciar a web:

```sh
WHISPER_MODEL=small WHISPER_DEVICE=cpu WHISPER_COMPUTE_TYPE=int8 npm run dev
```

Em uma instalação com CUDA compatível, use `WHISPER_DEVICE=cuda` e `WHISPER_COMPUTE_TYPE=float16`. O perfil `small`/CPU melhora a qualidade, mas pode aumentar a latência em máquinas mais lentas. `GET /health` informa que STT está disponível; esta versão usa a síntese de voz do navegador para TTS. O áudio capturado nunca é encaminhado à API de chat.

No frontend, habilite **Conversa por voz em tempo real** em Ajustes → Voz. A aplicação acessa o serviço pelo proxy same-origin `/voice`.
