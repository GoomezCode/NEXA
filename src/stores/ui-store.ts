import { create } from 'zustand';

import type { AiState } from '@/api/types';

export type AppView = 'chat' | 'memory' | 'monitor' | 'settings';

interface UiStore {
  activeView: AppView;
  activeSessionId: string | null;
  aiState: AiState;
  sidebarOpen: boolean;
  sessionsSheetOpen: boolean;
  setActiveView: (view: AppView) => void;
  setActiveSessionId: (id: string | null) => void;
  setAiState: (state: AiState) => void;
  toggleSidebar: () => void;
  setSessionsSheetOpen: (open: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activeView: 'chat',
  activeSessionId: null,
  aiState: 'idle',
  sidebarOpen: true,
  sessionsSheetOpen: false,
  setActiveView: (activeView) => set({ activeView }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId, aiState: 'idle' }),
  setAiState: (aiState) => set({ aiState }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSessionsSheetOpen: (sessionsSheetOpen) => set({ sessionsSheetOpen }),
}));
