import { describe, expect, it } from 'vitest';
import { transitionVoiceCall } from '@/features/voice/voice-call-state';

describe('voice call state machine', () => {
  it('walks through a call and returns to listening after a response', () => {
    let state = transitionVoiceCall('off', 'START');
    state = transitionVoiceCall(state, 'READY');
    state = transitionVoiceCall(state, 'VOICE');
    state = transitionVoiceCall(state, 'SILENCE');
    state = transitionVoiceCall(state, 'THINK');
    state = transitionVoiceCall(state, 'SPEAK');
    expect(transitionVoiceCall(state, 'DONE')).toBe('listening');
  });

  it('allows barge-in while speaking and always stops cleanly', () => {
    expect(transitionVoiceCall('speaking', 'VOICE')).toBe('hearing');
    expect(transitionVoiceCall('error', 'STOP')).toBe('off');
  });
});
