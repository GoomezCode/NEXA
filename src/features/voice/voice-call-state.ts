export type VoiceCallState = 'off' | 'starting' | 'listening' | 'hearing' | 'transcribing' | 'thinking' | 'speaking' | 'error';
export type VoiceCallEvent = 'START' | 'READY' | 'VOICE' | 'SILENCE' | 'TRANSCRIBE' | 'THINK' | 'SPEAK' | 'DONE' | 'STOP' | 'ERROR';

export function transitionVoiceCall(state: VoiceCallState, event: VoiceCallEvent): VoiceCallState {
  if (event === 'STOP') return 'off';
  if (event === 'ERROR') return 'error';
  const transitions: Partial<Record<VoiceCallState, Partial<Record<VoiceCallEvent, VoiceCallState>>>> = {
    off: { START: 'starting' }, starting: { READY: 'listening' }, listening: { VOICE: 'hearing' },
    hearing: { SILENCE: 'transcribing', VOICE: 'hearing' }, transcribing: { THINK: 'thinking', DONE: 'listening' },
    thinking: { SPEAK: 'speaking', VOICE: 'hearing', DONE: 'listening' }, speaking: { VOICE: 'hearing', DONE: 'listening' },
    error: { START: 'starting' },
  };
  return transitions[state]?.[event] ?? state;
}
