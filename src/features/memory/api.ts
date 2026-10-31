import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, set } from 'idb-keyval';

import { createId } from '@/lib/id';

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryInput {
  title: string;
  content: string;
  tags: string[];
}

export const MEMORY_LIMITS = {
  title: 80,
  content: 4000,
  tags: 8,
  tag: 24,
} as const;

const STORAGE_KEY = 'nexa:memory:v1';

let cache: MemoryEntry[] | null = null;
let persistQueue: Promise<void> = Promise.resolve();

/** Normaliza tags: minúsculas, sem vazias, sem duplicatas e com limites. */
export function normalizeMemoryTags(values: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of values) {
    const tag = value.trim().toLowerCase().slice(0, MEMORY_LIMITS.tag);

    if (!tag || seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    tags.push(tag);

    if (tags.length >= MEMORY_LIMITS.tags) {
      break;
    }
  }

  return tags;
}

export function parseMemoryTags(input: string): string[] {
  return normalizeMemoryTags(input.split(','));
}

function isMemoryEntry(value: unknown): value is MemoryEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<MemoryEntry>;

  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    typeof entry.title === 'string' &&
    entry.title.trim().length > 0 &&
    typeof entry.content === 'string' &&
    (entry.enabled === undefined || typeof entry.enabled === 'boolean') &&
    Array.isArray(entry.tags) &&
    typeof entry.createdAt === 'string' &&
    typeof entry.updatedAt === 'string'
  );
}

function sanitizeEntries(raw: unknown): MemoryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(isMemoryEntry)
    .map((entry) => ({
      ...entry,
      title: entry.title.trim().slice(0, MEMORY_LIMITS.title),
      content: entry.content.trim().slice(0, MEMORY_LIMITS.content),
      tags: normalizeMemoryTags(entry.tags),
      enabled: entry.enabled !== false,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function clone(entry: MemoryEntry): MemoryEntry {
  return { ...entry, tags: [...entry.tags] };
}

async function load(): Promise<MemoryEntry[]> {
  if (cache) {
    return cache;
  }

  try {
    cache = sanitizeEntries(await get<unknown>(STORAGE_KEY));
  } catch (error) {
    console.warn('NEXA: falha ao carregar a memória local.', error);
    cache = [];
  }

  return cache;
}

/**
 * Grava em fila para evitar perda de dados com mutações concorrentes.
 * Falhas de IndexedDB (modo privado, cota) não derrubam a sessão: o cache
 * em memória continua válido.
 */
async function persist(entries: MemoryEntry[]): Promise<void> {
  persistQueue = persistQueue
    .catch(() => undefined)
    .then(() => set(STORAGE_KEY, entries))
    .catch((error) => {
      console.warn('NEXA: falha ao salvar a memória local.', error);
    });

  await persistQueue;
}

function validate(input: MemoryInput): Pick<MemoryEntry, 'title' | 'content' | 'tags'> {
  const title = input.title.trim();
  const content = input.content.trim();

  if (!title) {
    throw new Error('Dê um nome à memória.');
  }

  if (!content) {
    throw new Error('Escreva o conteúdo da memória.');
  }

  return {
    title: title.slice(0, MEMORY_LIMITS.title),
    content: content.slice(0, MEMORY_LIMITS.content),
    tags: normalizeMemoryTags(input.tags),
  };
}

export async function listMemories(): Promise<MemoryEntry[]> {
  return (await load()).map(clone);
}

export async function createMemory(input: MemoryInput): Promise<MemoryEntry> {
  const entries = await load();
  const data = validate(input);
  const now = new Date().toISOString();
  const entry: MemoryEntry = {
    id: createId('mem'),
    ...data,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  entries.unshift(entry);
  await persist(entries);

  return clone(entry);
}

export async function updateMemory(id: string, input: MemoryInput): Promise<MemoryEntry> {
  const entries = await load();
  const index = entries.findIndex((entry) => entry.id === id);

  if (index < 0) {
    throw new Error('Memória não encontrada.');
  }

  const data = validate(input);
  const updated: MemoryEntry = {
    ...entries[index]!,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  entries.splice(index, 1);
  entries.unshift(updated);
  await persist(entries);

  return clone(updated);
}

export async function setMemoryEnabled(id: string, enabled: boolean): Promise<MemoryEntry> {
  const entries = await load();
  const entry = entries.find((item) => item.id === id);
  if (!entry) throw new Error('Memória não encontrada.');
  entry.enabled = enabled;
  entry.updatedAt = new Date().toISOString();
  await persist(entries);
  return clone(entry);
}

export async function deleteMemory(id: string): Promise<void> {
  const entries = await load();
  const remaining = entries.filter((entry) => entry.id !== id);

  if (remaining.length === entries.length) {
    throw new Error('Memória não encontrada.');
  }

  cache = remaining;
  await persist(remaining);
}

export async function clearMemoryStorage(): Promise<void> {
  cache = null;
  persistQueue = Promise.resolve();

  try {
    await del(STORAGE_KEY);
  } catch {
    // IndexedDB indisponível: segue sem persistência.
  }
}

export function resetMemoryCacheForTests(): void {
  cache = null;
  persistQueue = Promise.resolve();
}

export const memoryKeys = {
  all: ['memory'] as const,
};

export function useMemories() {
  return useQuery({
    queryKey: memoryKeys.all,
    queryFn: listMemories,
  });
}

export function useCreateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MemoryInput) => createMemory(input),
    onSuccess: (entry) => {
      queryClient.setQueryData<MemoryEntry[]>(memoryKeys.all, (current = []) => [
        entry,
        ...current,
      ]);
    },
  });
}

export function useUpdateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MemoryInput }) => updateMemory(id, input),
    onSuccess: (entry) => {
      queryClient.setQueryData<MemoryEntry[]>(memoryKeys.all, (current = []) =>
        [entry, ...current.filter((item) => item.id !== entry.id)].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    },
  });
}

export function useSetMemoryEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setMemoryEnabled(id, enabled),
    onSuccess: (entry) => {
      queryClient.setQueryData<MemoryEntry[]>(memoryKeys.all, (current = []) =>
        current.map((item) => item.id === entry.id ? entry : item),
      );
    },
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteMemory(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<MemoryEntry[]>(memoryKeys.all, (current = []) =>
        current.filter((item) => item.id !== id),
      );
    },
  });
}
