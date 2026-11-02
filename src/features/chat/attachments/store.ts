import { createStore, delMany, get, getMany, set } from 'idb-keyval';

export interface StoredAttachment { blob: Blob; thumb?: Blob; text?: string }
export interface AttachmentStore {
  put(id: string, value: StoredAttachment): Promise<void>;
  get(id: string): Promise<StoredAttachment | undefined>;
  getMany(ids: string[]): Promise<(StoredAttachment | undefined)[]>;
  deleteMany(ids: string[]): Promise<void>;
}

export function createAttachmentStore(namespace: string): AttachmentStore {
  const store = createStore(`nexa-attachments:${namespace}`, 'blobs');
  return {
    async put(id, value) {
      try { await set(id, value, store); }
      catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          throw new Error('O armazenamento de anexos deste navegador está cheio. Remova conversas ou arquivos e tente novamente.');
        }
        throw error;
      }
    },
    get: (id) => get<StoredAttachment>(id, store),
    getMany: (ids) => getMany<StoredAttachment>(ids, store),
    deleteMany: (ids) => delMany(ids, store),
  };
}
