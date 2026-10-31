import { useCallback, useEffect, useRef, useState } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permissão de microfone negada. Libere o acesso nas configurações do navegador.',
  'service-not-allowed':
    'O navegador bloqueou o reconhecimento de voz. Verifique as permissões do microfone.',
  'audio-capture': 'Nenhum microfone foi encontrado. Conecte um dispositivo e tente novamente.',
  'no-speech': 'Nenhuma fala foi detectada. Tente novamente mais perto do microfone.',
  network: 'Falha de rede no reconhecimento de voz. Verifique sua conexão.',
  abort: '',
};

export const SPEECH_UNSUPPORTED_MESSAGE =
  'Reconhecimento de voz não disponível neste navegador. Use o campo de texto.';

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionConstructor() !== null;
}

interface UseSpeechRecognitionOptions {
  lang?: string;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
}

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  cancel: () => void;
  clearError: () => void;
}

export function useSpeechRecognition({
  lang = 'pt-BR',
  onFinal,
  onError,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionResult {
  const [supported] = useState(isSpeechRecognitionSupported);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onFinalRef.current = onFinal;
    onErrorRef.current = onError;
  }, [onError, onFinal]);

  const fail = useCallback((message: string) => {
    setError(message);
    setListening(false);
    setInterim('');
    onErrorRef.current?.(message);
  }, []);

  const start = useCallback(() => {
    const Recognition = getRecognitionConstructor();

    if (!Recognition) {
      fail(SPEECH_UNSUPPORTED_MESSAGE);
      return;
    }

    if (recognitionRef.current) {
      return;
    }

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      const finalParts: string[] = [];
      const interimParts: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? '';

        if (result?.isFinal) {
          finalParts.push(transcript);
        } else {
          interimParts.push(transcript);
        }
      }

      setInterim(interimParts.join(' ').trim());

      const trimmed = finalParts.join(' ').trim();

      if (trimmed) {
        onFinalRef.current?.(trimmed);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') {
        return;
      }

      fail(ERROR_MESSAGES[event.error] || 'Não foi possível reconhecer a fala. Tente novamente.');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    setError(null);
    setInterim('');
    setListening(true);

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      fail('Não foi possível iniciar o microfone. Tente novamente.');
    }
  }, [fail, lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
    setInterim('');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { supported, listening, interim, error, start, stop, cancel, clearError };
}
