import { beforeEach, describe, expect, it } from 'vitest';

import {
  MAX_NOTIFICATIONS,
  notify,
  resetNotificationsForTests,
  useNotificationStore,
} from '@/stores/notification-store';

describe('notification-store', () => {
  beforeEach(() => {
    resetNotificationsForTests();
  });

  it('limita a fila a três notificações simultâneas', () => {
    notify({ tone: 'info', title: 'Um' });
    notify({ tone: 'info', title: 'Dois' });
    notify({ tone: 'info', title: 'Três' });
    notify({ tone: 'warning', title: 'Quatro' });

    const items = useNotificationStore.getState().items;

    expect(items).toHaveLength(MAX_NOTIFICATIONS);
    expect(items.map((item) => item.title)).toEqual(['Dois', 'Três', 'Quatro']);
  });

  it('remove uma notificação pelo identificador', () => {
    const id = notify({ tone: 'error', title: 'Falha' });

    useNotificationStore.getState().remove(id);

    expect(useNotificationStore.getState().items).toEqual([]);
  });
});
