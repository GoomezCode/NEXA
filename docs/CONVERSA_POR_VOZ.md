# Conversa por voz

O modo chamada é opt-in. Ative-o em **Ajustes → Voz**; o botão aparece no composer quando a NEXA API está disponível. `Ctrl/Cmd + Shift + V` inicia ou encerra a chamada e `Esc` encerra. O indicador informa quando o microfone está ativo; **Silenciar** interrompe a captura. Use fones com a interrupção por voz ativada. Em ambientes com alto-falantes, escolha meia-duplex. A chamada fica indisponível nos modos offline e demonstração.

O navegador captura mono PCM e usa um detector local de energia para segmentar a fala, com pausa final configurável em **Ajustes → Voz**. Ele envia segmentos WAV autenticados para `POST /api/v1/voice/stt` na NEXA API. A API roda faster-whisper fora do event loop, decodifica o áudio em memória e não o persiste. O modelo é carregado sob demanda no servidor; configure `VOICE_STT_MODEL`, `VOICE_STT_DEVICE`, `VOICE_STT_COMPUTE_TYPE` e `VOICE_STT_MODEL_DIR` no ambiente da API. O áudio sai do dispositivo e chega ao servidor API configurado.

A saída falada usa `speechSynthesis` do navegador e a voz padrão em português; pode ser interrompida pelo fluxo atual do chat. A integração de TTS local em streaming permanece pendente. O microfone requer HTTPS ou `localhost`.
