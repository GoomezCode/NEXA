# NEXA local voice service

Serviço local de reconhecimento de fala. O áudio é recebido em memória e não é salvo em disco; o modelo Whisper é baixado uma vez para `models/`.

```sh
cd voice-server
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
WHISPER_MODEL=small WHISPER_DEVICE=cpu WHISPER_COMPUTE_TYPE=int8 uvicorn main:app --host 127.0.0.1 --port 8765
```

Use `WHISPER_DEVICE=cuda` e `WHISPER_COMPUTE_TYPE=float16` em uma instalação com CUDA compatível. O padrão `base`/CPU prioriza compatibilidade e pode exceder a meta de latência. `GET /health` informa que STT está disponível; esta versão usa a síntese de voz do navegador para TTS. O áudio capturado nunca é encaminhado à API de chat.

No frontend, habilite **Conversa por voz em tempo real** em Ajustes → Voz. A aplicação acessa o serviço pelo proxy same-origin `/voice`.
