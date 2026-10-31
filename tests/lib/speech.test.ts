import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { speakText, SpeechStreamer, toSpeakableText } from '@/lib/speech';
import { resetSettingsForTests, useSettingsStore } from '@/stores/settings-store';

class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  voice: unknown = null;

  constructor(text: string) {
    this.text = text;
  }
}

describe('speech', () => {
  const speak = vi.fn();

  beforeEach(() => {
    resetSettingsForTests();
    speak.mockClear();
    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      getVoices: () => [],
      speak,
    });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remove marcação e blocos de código antes da leitura', () => {
    const markdown = [
      '## Status',
      'O núcleo está **operacional**.',
      '```ts',
      'const segredo = 1;',
      '```',
      'Veja [o painel](https://example.com).',
    ].join('\n');

    const text = toSpeakableText(markdown);

    expect(text).toBe('Status O núcleo está operacional. Veja o painel.');
    expect(text).not.toContain('const segredo');
  });

  it('não fala quando o TTS está desligado', () => {
    speakText('Olá, operador.');

    expect(speak).not.toHaveBeenCalled();
  });

  it('fala a resposta com a velocidade configurada', () => {
    useSettingsStore.getState().update({ ttsEnabled: true, speechRate: 1.5 });

    speakText('**Olá**, operador!');

    expect(speak).toHaveBeenCalledOnce();
    const utterance = speak.mock.calls[0]?.[0] as FakeUtterance;
    expect(utterance.text).toBe('Olá, operador!');
    expect(utterance.rate).toBe(1.5);
    expect(utterance.lang).toBe('pt-BR');
  });

  it('fala frases completas antes do fim do stream e descarrega o restante', () => {
    useSettingsStore.getState().update({ ttsEnabled: true });
    const streamer = new SpeechStreamer();
    streamer.push('Esta é uma frase suficientemente longa para ser falada antes do fim. ');
    expect(speak).toHaveBeenCalledOnce();
    streamer.push('Resto curto');
    streamer.finish();
    expect(speak).toHaveBeenCalledTimes(2);
    expect((speak.mock.calls[1]?.[0] as FakeUtterance).text).toBe('Resto curto');
  });

  it('ignora blocos de código enquanto recebe tokens em partes', () => {
    useSettingsStore.getState().update({ ttsEnabled: true });
    const streamer = new SpeechStreamer();
    streamer.push('A resposta é suficientemente longa para falar. ```js\n');
    streamer.push('segredo();\n``` Texto final.');
    streamer.finish();
    const spoken = speak.mock.calls.map(([item]) => (item as FakeUtterance).text).join(' ');
    expect(spoken).not.toContain('segredo');
    expect(spoken).toContain('A resposta');
    expect(spoken).toContain('Texto final');
  });
});
