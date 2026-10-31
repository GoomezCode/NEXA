import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authorizedFetch, authorizedRequest } from './auth';

export type ProviderName = 'openai' | 'anthropic' | 'google' | 'ollama_cloud' | 'nvidia' | 'openai_compatible';

export interface ProviderKeySummary {
  provider: ProviderName;
  key_last4: string;
  base_url: string | null;
  default_model: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface ProviderKeyInput {
  api_key: string;
  base_url?: string;
  default_model?: string;
}

export const providerKeyLabels: Record<ProviderName, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  ollama_cloud: 'Ollama Cloud',
  nvidia: 'NVIDIA NIM',
  openai_compatible: 'OpenAI-compatible',
};

const keyPath = (provider: ProviderName) => `/me/providers/${provider}`;
export const providerKeysKey = ['provider-keys'] as const;

export function useProviderKeys(enabled: boolean) {
  return useQuery({
    queryKey: providerKeysKey,
    queryFn: () => authorizedRequest<ProviderKeySummary[]>('/me/providers'),
    enabled,
    staleTime: 30_000,
  });
}

export function useSaveProviderKey() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, input }: { provider: ProviderName; input: ProviderKeyInput }) =>
      authorizedRequest<ProviderKeySummary>(keyPath(provider), { method: 'PUT', body: input }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: providerKeysKey }),
        client.invalidateQueries({ queryKey: ['models'] }),
      ]);
    },
  });
}

export function useDeleteProviderKey() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (provider: ProviderName) => {
      await authorizedFetch(keyPath(provider), { method: 'DELETE' });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: providerKeysKey }),
        client.invalidateQueries({ queryKey: ['models'] }),
      ]);
    },
  });
}

export function useTestProviderKey() {
  return useMutation({
    mutationFn: (provider: ProviderName) =>
      authorizedRequest<{ provider: ProviderName; valid: boolean; message: string }>(
        `${keyPath(provider)}/test`, { method: 'POST' },
      ),
  });
}
