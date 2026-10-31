import { del, get, set } from 'idb-keyval';

import type { ChatSnapshot, ChatStorage } from './types';

const DEFAULT_STORAGE_KEY = 'nexa:chat:v1';

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Persiste sessões e mensagens no IndexedDB. A API NEXA não guarda histórico:
 * o navegador é a fonte das conversas, com uma chave por identidade
 * (`nexa:chat:v2:guest`, `nexa:chat:v2:user:<id>`) ou a chave do modo demo.
 */
export function createIndexedDbChatStorage(key = DEFAULT_STORAGE_KEY): ChatStorage {
  return {
    async load() {
      return (await get<ChatSnapshot>(key)) ?? null;
    },
    async save(snapshot) {
      await set(key, snapshot);
    },
  };
}

export async function clearPersistedChat(key = DEFAULT_STORAGE_KEY): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  try {
    await del(key);
  } catch {
    // IndexedDB pode estar indisponível (modo privado); seguir sem persistência.
  }
}
