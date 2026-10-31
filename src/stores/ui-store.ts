import { create } from 'zustand';

import type { AiState } from '@/api/types';

interface UiStore {
  aiState: AiState;
  sidebarOpen: boolean;
  setAiState: (state: AiState) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  aiState: 'idle',
  sidebarOpen: true,
  setAiState: (aiState) => set({ aiState }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
