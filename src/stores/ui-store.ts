import { create } from 'zustand';

import type { AiState } from '@/api/types';

interface UiStore {
  aiState: AiState;
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
  setAiState: (state: AiState) => void;
  toggleSidebar: () => void;
  toggleContextPanel: () => void;
}

function loadContextPanelOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem('nexa:context-panel-hidden') !== 'true';
  } catch {
    return true;
  }
}

export const useUiStore = create<UiStore>((set) => ({
  aiState: 'idle',
  sidebarOpen: true,
  contextPanelOpen: loadContextPanelOpen(),
  setAiState: (aiState) => set({ aiState }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleContextPanel: () => set((state) => {
    const contextPanelOpen = !state.contextPanelOpen;
    try {
      window.localStorage.setItem('nexa:context-panel-hidden', String(!contextPanelOpen));
    } catch {
      // A opção continua ativa durante esta sessão mesmo se o storage não estiver disponível.
    }
    return { contextPanelOpen };
  }),
}));
