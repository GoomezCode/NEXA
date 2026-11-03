# Conversa por voz

O modo chamada é opt-in. Ative-o em **Ajustes → Voz**; o botão de áudio aparece então no composer. `Ctrl/Cmd + Shift + V` inicia ou encerra a chamada e `Esc` encerra. O indicador informa quando o microfone está ativo; **Silenciar** interrompe a captura de voz. Use fones com a interrupção por voz ativada. Em ambientes com alto-falantes, escolha meia-duplex.

O navegador captura áudio com cancelamento de eco, redução de ruído e ganho automático. Um detector local baseado no nível de energia identifica fala e cerca de 720 ms de silêncio. Segmentos são enviados a `POST /voice/stt` no servidor FastAPI local. O servidor usa faster-whisper e decodifica em memória; o áudio não é guardado. O texto transcrito segue o fluxo de chat já configurado (local ou API). Com o adaptador Ollama, a chamada desativa `think` e solicita respostas curtas em português.

A saída falada usa `speechSynthesis` do navegador e sua voz padrão em português; pode ser cancelada pelo fluxo atual do chat. A integração de TTS local em streaming permanece pendente. Na primeira configuração, execute `npm run voice:setup`. Depois, `npm run dev` inicia automaticamente a aplicação e o STT local juntos. Instalação e opções de hardware: [voice-server/README.md](../voice-server/README.md).

Microfone requer HTTPS ou `localhost`. Se o status do serviço indicar indisponível, confira a instalação inicial com `npm run voice:setup` e reinicie `npm run dev`. O serviço usa Whisper `small` em CPU para priorizar precisão; o tempo depende do hardware e ainda precisa ser medido. Configure `WHISPER_MODEL=base` se preferir reduzir latência. Não há alegação de latência abaixo de 0,5 s sem medição local.
