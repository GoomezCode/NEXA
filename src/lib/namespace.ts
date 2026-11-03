import { useAuthStore } from '@/stores/auth-store';
import { isOfflineMode } from '@/stores/connection-store';
import { getSettingsSnapshot } from '@/stores/settings-store';

export function namespace(): string {
  if (getSettingsSnapshot().demoMode && !isOfflineMode()) return 'demo';
  if (isOfflineMode()) return 'offline';
  const session = useAuthStore.getState().session;
  return !session || session.role === 'guest' ? 'guest' : `user:${session.userId}`;
}
