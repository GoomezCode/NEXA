import { create } from 'zustand';

export type NotificationTone = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  message?: string;
  duration: number;
}

interface NotificationInput {
  tone: NotificationTone;
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationStore {
  items: AppNotification[];
  add: (input: NotificationInput) => string;
  remove: (id: string) => void;
  clear: () => void;
}

export const MAX_NOTIFICATIONS = 3;

let sequence = 0;

export const useNotificationStore = create<NotificationStore>((set) => ({
  items: [],
  add: (input) => {
    sequence += 1;
    const id = `note-${Date.now()}-${sequence}`;
    const notification: AppNotification = {
      id,
      tone: input.tone,
      title: input.title,
      message: input.message,
      duration: input.duration ?? 6000,
    };

    set((state) => ({
      items: [...state.items, notification].slice(-MAX_NOTIFICATIONS),
    }));

    return id;
  },
  remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  clear: () => set({ items: [] }),
}));

export function notify(input: NotificationInput): string {
  return useNotificationStore.getState().add(input);
}

export function resetNotificationsForTests(): void {
  useNotificationStore.setState({ items: [] });
}
