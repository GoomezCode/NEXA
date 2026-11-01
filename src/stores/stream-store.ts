import { create } from 'zustand';

interface StreamState {
  messageId: string | null;
  content: string;
  begin: (messageId: string) => void;
  append: (messageId: string, content: string) => void;
  clear: (messageId: string) => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  messageId: null,
  content: '',
  begin: (messageId) => set({ messageId, content: '' }),
  append: (messageId, content) => set((state) => state.messageId === messageId
    ? { content: state.content + content }
    : state),
  clear: (messageId) => set((state) => state.messageId === messageId
    ? { messageId: null, content: '' }
    : state),
}));
