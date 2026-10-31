import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useConnectionStore } from '@/stores/connection-store';

import { authorizedRequest } from './auth';
import { shouldRetryRequest } from './errors';
import type { UsageInfo } from './types';

/** Cota atual do papel autenticado (`GET /usage`). */
export function useUsage() {
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const role = useAuthStore((state) => state.session?.role ?? null);
  const offline = useConnectionStore((state) => state.mode === 'offline');

  return useQuery({
    queryKey: ['usage', role],
    queryFn: () => authorizedRequest<UsageInfo>('/usage'),
    enabled: !offline && !demoMode && role !== null,
    staleTime: 15_000,
    retry: shouldRetryRequest,
  });
}
