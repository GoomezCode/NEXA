import { useEffect } from 'react';
import { useVoiceCall } from './use-voice-call';
import { VoiceCallContext } from './voice-call-context';
import { useUiStore } from '@/stores/ui-store';
import { useSpeechStore } from '@/stores/speech-store';

export function VoiceCallProvider({ children, onTranscript, onInterrupt, isBusy }: { children: React.ReactNode; onTranscript: (text: string) => void; onInterrupt: () => void; isBusy: boolean }) {
  const isSpeaking = useSpeechStore((store) => store.isSpeaking);
  const call = useVoiceCall({ onTranscript, onInterrupt, isBusy, isSpeaking });
  const { active, state, setEvent, stop, start } = call;
  const setAiState = useUiStore((state) => state.setAiState);
  useEffect(() => {
    if (!active) return;
    const aiState = state === 'listening' || state === 'hearing' ? 'listening' : state === 'speaking' ? 'responding' : state === 'error' ? 'error' : 'processing';
    setAiState(aiState);
    return () => { if (useUiStore.getState().aiState !== 'idle') setAiState('idle'); };
  }, [active, state, setAiState]);
  useEffect(() => {
    if (isSpeaking && active) setEvent('SPEAK');
    else if (isBusy && active && state === 'transcribing') setEvent('THINK');
    else if (!isBusy && active && (state === 'thinking' || state === 'speaking')) setEvent('DONE');
  }, [isBusy, isSpeaking, active, setEvent, state]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && active) stop();
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'v') { event.preventDefault(); void start(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [active, start, stop]);
  return <VoiceCallContext.Provider value={{ active: call.active, muted: call.muted, elapsed: call.elapsed, state: call.state, error: call.error, onToggle: call.start, onMute: call.toggleMute }}>{children}</VoiceCallContext.Provider>;
}
