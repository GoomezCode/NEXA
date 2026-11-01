import { getSettingsSnapshot } from '@/stores/settings-store';
import { useSpeechStore } from '@/stores/speech-store';

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Remove marcação suficiente para uma leitura natural da resposta. */
export function toSpeakableText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/\bhttps?:\/\/\S+/gi, ' ')
    .replace(/[*_~#>|]+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function enqueueSpeechText(text: string): void {
  if (!isSpeechSynthesisSupported() || !getSettingsSnapshot().ttsEnabled || !text.trim()) return;
  const utterance = new SpeechSynthesisUtterance(text.trim());
  const settings = getSettingsSnapshot();
  const synth = window.speechSynthesis;
  utterance.lang = 'pt-BR';
  utterance.rate = settings.speechRate;
  const voice = synth.getVoices().find((item) => item.voiceURI === settings.speechVoiceURI) ??
    synth.getVoices().find((item) => item.lang.toLowerCase().startsWith('pt-br'));
  if (voice) utterance.voice = voice;
  utterance.onstart = () => useSpeechStore.getState().setSpeaking(true);
  utterance.onend = () => useSpeechStore.getState().setSpeaking(false);
  utterance.onerror = () => useSpeechStore.getState().setSpeaking(false);
  synth.speak(utterance);
}

/** Quebra o stream em frases curtas para começar a leitura antes da resposta terminar. */
export interface SpeechEngine {
  push(chunk: string): void;
  finish(): void;
  cancel(): void;
}

/** Implementação local de TTS baseada na Web Speech API do navegador. */
export class SpeechStreamer implements SpeechEngine {
  private buffer = '';
  private carry = '';
  private inCode = false;
  private stopped = false;

  push(chunk: string): void {
    if (this.stopped || !isSpeechSynthesisSupported() || !getSettingsSnapshot().ttsEnabled) return;
    const input = this.carry + chunk;
    this.carry = '';
    let cursor = 0;
    while (cursor < input.length) {
      const fence = input.indexOf('```', cursor);
      if (fence < 0) {
        const tail = input.slice(cursor);
        if (tail.endsWith('`') || tail.endsWith('``')) {
          this.carry = tail.slice(-2);
          this.append(tail.slice(0, -2));
        } else this.append(tail);
        break;
      }
      this.append(input.slice(cursor, fence));
      this.inCode = !this.inCode;
      cursor = fence + 3;
      if (this.inCode) {
        const closing = input.indexOf('```', cursor);
        if (closing < 0) break;
        cursor = closing;
      }
    }
  }

  finish(): void {
    if (this.stopped) return;
    if (!this.inCode) this.append(this.carry);
    this.carry = '';
    const tail = toSpeakableText(this.buffer);
    this.buffer = '';
    if (tail) enqueueSpeechText(tail);
  }

  cancel(): void {
    this.stopped = true;
    this.buffer = '';
    this.carry = '';
    cancelSpeech();
  }

  private append(value: string): void {
    if (this.inCode || !value) return;
    this.buffer += value;
    for (;;) {
      const boundaries = /[.!?;\n]/g;
      let sentence: RegExpExecArray | null = null;
      let match: RegExpExecArray | null;
      while ((match = boundaries.exec(this.buffer))) {
        if (match.index + 1 >= 40) { sentence = match; break; }
      }
      if (sentence) {
        this.emit(sentence.index + 1);
        continue;
      }
      if (this.buffer.length >= 200) {
        const boundary = Math.max(this.buffer.lastIndexOf(',', 200), this.buffer.lastIndexOf(' ', 200));
        this.emit(boundary >= 40 ? boundary + 1 : 200);
        continue;
      }
      break;
    }
  }

  private emit(length: number): void {
    const text = toSpeakableText(this.buffer.slice(0, length));
    this.buffer = this.buffer.slice(length);
    if (text) enqueueSpeechText(text);
  }
}

export function cancelSpeech(): void {
  useSpeechStore.getState().setSpeaking(false);
  if (!isSpeechSynthesisSupported()) {
    return;
  }

  window.speechSynthesis.cancel();
}

export function speakText(text: string): void {
  if (!isSpeechSynthesisSupported()) {
    return;
  }

  const settings = getSettingsSnapshot();

  if (!settings.ttsEnabled) {
    return;
  }

  const content = toSpeakableText(text);

  if (!content) {
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  enqueueSpeechText(content);
}
