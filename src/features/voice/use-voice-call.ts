import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelSpeech, setVoiceCallSpeechEnabled } from '@/lib/speech';
import { useSettingsStore } from '@/stores/settings-store';
import { transitionVoiceCall, type VoiceCallEvent, type VoiceCallState } from './voice-call-state';
import { setVoiceCallActive } from './voice-call-runtime';

export function useVoiceCall(options: { onTranscript: (text: string) => void; onInterrupt: () => void; isBusy: boolean }) {
  const [state, setState] = useState<VoiceCallState>('off');
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const frameRef = useRef(0);
  const activeRef = useRef(false);
  const mutedRef = useRef(false);
  const setEvent = useCallback((event: VoiceCallEvent) => setState((current) => transitionVoiceCall(current, event)), []);
  useEffect(() => { optionsRef.current = options; }, [options]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setVoiceCallActive(false);
    setVoiceCallSpeechEnabled(false);
    cancelAnimationFrame(frameRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    mediaRef.current?.getTracks().forEach((track) => track.stop()); mediaRef.current = null;
    void audioRef.current?.close(); audioRef.current = null;
    cancelSpeech(); setEvent('STOP'); setMuted(false); mutedRef.current = false;
  }, [setEvent]);

  const start = useCallback(async () => {
    if (activeRef.current) { stop(); return; }
    setError(null); setEvent('START');
    setElapsed(0);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError('A chamada por voz exige HTTPS ou localhost e acesso ao microfone.'); setEvent('ERROR'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      mediaRef.current = stream; activeRef.current = true; setEvent('READY');
      setVoiceCallActive(true);
      setVoiceCallSpeechEnabled(true);
      const context = new AudioContext(); audioRef.current = context;
      const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser(); analyser.fftSize = 512; source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let speaking = false; let silenceAt = 0; let chunks: Blob[] = []; let lastInterrupt = 0;
      const begin = () => {
        speaking = true; silenceAt = 0; chunks = [];
        if (typeof MediaRecorder === 'undefined') throw new Error('Este navegador não permite capturar áudio para transcrição local.');
        const recorder = new MediaRecorder(stream); recorderRef.current = recorder;
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = () => {
          if (!activeRef.current || chunks.length === 0) return;
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          if (blob.size < 1200) { setEvent('DONE'); return; }
          setEvent('SILENCE');
          const form = new FormData(); form.append('audio', blob, 'utterance.webm'); form.append('language', 'pt');
          void fetch('/voice/stt', { method: 'POST', body: form }).then(async (response) => {
            if (!response.ok) throw new Error((await response.text()) || 'Servidor de voz indisponível.');
            return response.json() as Promise<{ text?: string }>;
          }).then(({ text }) => { if (text?.trim() && activeRef.current) { optionsRef.current.onTranscript(text.trim()); setEvent('THINK'); } else setEvent('DONE'); })
            .catch((cause: unknown) => { if (activeRef.current) { const message = cause instanceof Error ? cause.message : 'Falha na transcrição local.'; stop(); setError(message); setEvent('ERROR'); } });
        };
        recorder.start(250); setEvent('VOICE');
      };
      const sample = () => {
        if (!activeRef.current) return;
        if (optionsRef.current.isBusy && useSettingsStore.getState().settings.callHalfDuplex) {
          frameRef.current = requestAnimationFrame(sample);
          return;
        }
        analyser.getByteTimeDomainData(samples);
        let energy = 0; for (const value of samples) { const normalized = (value - 128) / 128; energy += normalized * normalized; }
        const rms = Math.sqrt(energy / samples.length);
        const threshold = optionsRef.current.isBusy ? 0.09 : 0.035;
        if (rms > threshold && !mutedRef.current) {
          if (optionsRef.current.isBusy && useSettingsStore.getState().settings.callBargeIn && Date.now() - lastInterrupt > 800) { lastInterrupt = Date.now(); cancelSpeech(); optionsRef.current.onInterrupt(); }
          if (!speaking) begin();
          silenceAt = 0;
        } else if (speaking && rms < 0.02) {
          silenceAt ||= Date.now();
          if (Date.now() - silenceAt > 720) { speaking = false; recorderRef.current?.stop(); setEvent('DONE'); }
        }
        frameRef.current = requestAnimationFrame(sample);
      };
      frameRef.current = requestAnimationFrame(sample);
    } catch (cause) {
      stop(); setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar o microfone.'); setEvent('ERROR');
    }
  }, [setEvent, stop]);

  const toggleMute = useCallback(() => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); }, []);
  useEffect(() => { if (state === 'off' || state === 'error') return; const id = window.setInterval(() => setElapsed((value) => value + 1), 1000); return () => window.clearInterval(id); }, [state]);
  useEffect(() => () => stop(), [stop]);
  return { state, active: state !== 'off' && state !== 'error', muted, elapsed, error, start, stop, toggleMute, setEvent };
}
