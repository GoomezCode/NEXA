import { createContext, useContext } from 'react';

export interface VoiceCallControls {
  active: boolean; muted: boolean; elapsed: number; state: string; error: string | null;
  onToggle: () => void; onMute: () => void;
}
export const VoiceCallContext = createContext<VoiceCallControls | undefined>(undefined);
export function useVoiceCallControls() { return useContext(VoiceCallContext); }
