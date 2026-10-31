import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  SPEECH_UNSUPPORTED_MESSAGE,
  useSpeechRecognition,
} from '@/features/voice/use-speech-recognition';

describe('useSpeechRecognition', () => {
  it('informa o fallback quando o navegador não oferece reconhecimento', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onError }));

    expect(result.current.supported).toBe(false);

    act(() => {
      result.current.start();
    });

    expect(result.current.error).toBe(SPEECH_UNSUPPORTED_MESSAGE);
    expect(result.current.listening).toBe(false);
    expect(onError).toHaveBeenCalledWith(SPEECH_UNSUPPORTED_MESSAGE);
  });
});
