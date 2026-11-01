import { queryClient } from '@/app/query-client';
import { useAuthStore } from '@/stores/auth-store';
import { getSettingsSnapshot } from '@/stores/settings-store';

import { HttpChatAdapter } from './adapters/http';
import { createLocalChatRepository } from './adapters/local-chat';
import { MockChatAdapter } from './adapters/mock';
import { OllamaChatAdapter } from './adapters/ollama';
import { createIndexedDbChatStorage } from './storage/indexed-db';
import type { ChatAdapter } from './types';
import { isOfflineMode, useConnectionStore } from '@/stores/connection-store';

let adapter: ChatAdapter | undefined;

function demoFailureRequested(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('demoError') === '1';
}

function namespace(): string {
  if (isOfflineMode()) return 'offline';
  const session = useAuthStore.getState().session;
  return !session || session.role === 'guest' ? 'guest' : `user:${session.userId}`;
}

/**
 * Retorna o adaptador ativo. A escolha vem das preferências persistidas
 * (`demoMode`/`apiUrl`), que herdam `VITE_DEMO_MODE` e `VITE_API_URL` na
 * primeira execução.
 */
export function getChatAdapter(): ChatAdapter {
  if (adapter) {
    return adapter;
  }

  const { demoMode } = getSettingsSnapshot();

  adapter = isOfflineMode()
    ? new OllamaChatAdapter(createLocalChatRepository({ storage: createIndexedDbChatStorage('nexa:chat:v2:offline') }))
    : demoMode
    ? new MockChatAdapter({
        storage: createIndexedDbChatStorage(),
        tokenDelayMs: Number(import.meta.env.VITE_MOCK_TOKEN_DELAY ?? 22),
        failFirstStream: demoFailureRequested(),
      })
    : new HttpChatAdapter(
        createLocalChatRepository({
          storage: createIndexedDbChatStorage(`nexa:chat:v2:${namespace()}`),
        }),
      );

  return adapter;
}

// Ao trocar de identidade, descarta o adaptador e o cache para não mostrar o
// histórico de um usuário para outro.
let identity = namespace();

useAuthStore.subscribe(() => {
  const next = namespace();
  if (next === identity) return;

  identity = next;
  adapter = undefined;
  queryClient.clear();
});

useConnectionStore.subscribe(() => {
  const next = namespace();
  if (next === identity) return;
  identity = next;
  adapter = undefined;
  queryClient.clear();
});

export function resetChatAdapterForTests(): void {
  adapter = undefined;
}

export function resetChatAdapter(): void {
  adapter = undefined;
  queryClient.clear();
}
