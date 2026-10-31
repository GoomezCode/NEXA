import { useQuery } from '@tanstack/react-query';

import { useSettingsStore } from '@/stores/settings-store';
import { useConnectionStore } from '@/stores/connection-store';

import { request } from './client/http';

export interface HealthStatus {
  status: 'ok' | 'error' | 'degraded';
  version?: string;
  message?: string;
}

/** Saúde da API (rota pública na raiz, a cada 30 s). */
export function useApiHealth() {
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offline = useConnectionStore((state) => state.mode === 'offline');

  return useQuery({
    queryKey: ['health'],
    queryFn: () => request<HealthStatus>('/health', { root: true }),
    enabled: !offline && !demoMode,
    refetchInterval: 30_000,
    retry: false,
  });
}
