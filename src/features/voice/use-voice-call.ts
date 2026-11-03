import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelSpeech, setVoiceCallSpeechEnabled } from '@/lib/speech';
import { useSettingsStore } from '@/stores/settings-store';
import { transitionVoiceCall, type VoiceCallEvent, type VoiceCallState } from './voice-call-state';
import { setVoiceCallActive } from './voice-call-runtime';

function toWav(chunks: Float32Array[], sampleRate: number): Blob {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, 'RIFF'); view.setUint32(4, 36 + sampleCount * 2, true); writeText(8, 'WAVE');
  writeText(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeText(36, 'data'); view.setUint32(40, sampleCount * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const sample of chunk) {
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function useVoiceCall(options: { onTranscript: (text: string) => void; onInterrupt: () => void; isBusy: boolean; isSpeaking: boolean }) {
  const [state, setState] = useState<VoiceCallState>('off');
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  const mediaRef = useRef<MediaStream | null>(null);
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
      if (!context.createScriptProcessor) throw new Error('Este navegador não permite capturar áudio para transcrição local.');
      let speaking = false; let silenceAt = 0; let lastInterrupt = 0;
      const preRoll: Float32Array[] = [];
      let segmentChunks: Float32Array[] | null = null;
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain(); silentGain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        const chunk = new Float32Array(event.inputBuffer.getChannelData(0));
        preRoll.push(chunk);
        if (preRoll.length > 8) preRoll.shift();
        segmentChunks?.push(chunk);
      };
      source.connect(processor); processor.connect(silentGain); silentGain.connect(context.destination);
      const submitSegment = (chunks: Float32Array[]) => {
        const blob = toWav(chunks, context.sampleRate);
        if (!activeRef.current) return;
        if (blob.size < 1200) { setEvent('SILENCE'); setEvent('DONE'); return; }
        setEvent('SILENCE');
        const form = new FormData(); form.append('audio', blob, 'utterance.wav'); form.append('language', 'pt');
        void fetch('/voice/stt', { method: 'POST', body: form }).then(async (response) => {
          if (!response.ok) throw new Error((await response.text()) || 'Servidor de voz indisponível.');
          return response.json() as Promise<{ text?: string }>;
        }).then(({ text }) => { if (text?.trim() && activeRef.current) { optionsRef.current.onTranscript(text.trim()); setEvent('THINK'); } else setEvent('DONE'); })
          .catch((cause: unknown) => { if (activeRef.current) { const message = cause instanceof Error ? cause.message : 'Falha na transcrição local.'; setError(message); setEvent('DONE'); } });
      };
      const begin = () => {
        speaking = true; silenceAt = 0;
        setError(null);
        segmentChunks = [...preRoll];
        setEvent('VOICE');
      };
      const sample = () => {
        if (!activeRef.current) return;
        if (optionsRef.current.isBusy && (!optionsRef.current.isSpeaking || useSettingsStore.getState().settings.callHalfDuplex)) {
          frameRef.current = requestAnimationFrame(sample);
          return;
        }
        analyser.getByteTimeDomainData(samples);
        let energy = 0; for (const value of samples) { const normalized = (value - 128) / 128; energy += normalized * normalized; }
        const rms = Math.sqrt(energy / samples.length);
        const threshold = optionsRef.current.isSpeaking ? 0.055 : 0.024;
        if (rms > threshold && !mutedRef.current) {
          if (optionsRef.current.isSpeaking && useSettingsStore.getState().settings.callBargeIn && Date.now() - lastInterrupt > 800) { lastInterrupt = Date.now(); cancelSpeech(); optionsRef.current.onInterrupt(); }
          if (!speaking) begin();
          silenceAt = 0;
        } else if (speaking && rms < 0.016) {
          silenceAt ||= Date.now();
          if (Date.now() - silenceAt > 720) {
            speaking = false;
            const finished = segmentChunks ?? [];
            segmentChunks = null;
            submitSegment(finished);
          }
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
