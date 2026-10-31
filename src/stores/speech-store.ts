import { create } from 'zustand';

interface SpeechState {
  isSpeaking: boolean;
  setSpeaking: (isSpeaking: boolean) => void;
}

export const useSpeechStore = create<SpeechState>((set) => ({
  isSpeaking: false,
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
}));
