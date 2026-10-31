import { listMemories, type MemoryEntry } from '@/features/memory/api';
import { useAuthStore } from '@/stores/auth-store';
import { getSettingsSnapshot } from '@/stores/settings-store';
import { isOfflineMode } from '@/stores/connection-store';

export interface ChatPersonalization {
  display_name?: string;
  memories: { title: string; content: string }[];
}

const MAX_MEMORIES = 20;
const MAX_CHARS = 6000;

function words(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]{3,}/gu) ?? []);
}

export function selectRelevantMemories(
  memories: MemoryEntry[],
  message: string,
  budget = MAX_CHARS,
): ChatPersonalization['memories'] {
  const terms = words(message);
  const candidates = memories.filter((memory) => memory.enabled).map((memory, index) => {
    const searchable = words([memory.title, memory.content, ...memory.tags].join(' '));
    const overlap = [...terms].filter((term) => searchable.has(term)).length;
    const tagMatches = memory.tags.filter((tag) => [...terms].some((term) => tag.includes(term))).length;
    return { memory, index, score: overlap + tagMatches * 2 };
  });
  candidates.sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt) || a.index - b.index);

  const selected: ChatPersonalization['memories'] = [];
  let used = 0;
  for (const { memory } of candidates) {
    if (selected.length >= MAX_MEMORIES) break;
    const remaining = budget - used;
    if (remaining <= 0) break;
    const title = memory.title.slice(0, Math.min(160, remaining));
    const contentBudget = remaining - title.length;
    if (contentBudget <= 0) break;
    const content = memory.content.slice(0, contentBudget);
    selected.push({ title, content });
    used += title.length + content.length;
  }
  return selected;
}

export async function buildPersonalization(message: string): Promise<ChatPersonalization> {
  const settingsName = getSettingsSnapshot().displayName.trim();
  const accountName = isOfflineMode() ? undefined : useAuthStore.getState().session?.username?.trim();
  const displayName = settingsName && settingsName !== 'Operador' ? settingsName : accountName;
  const memories = await listMemories();
  return {
    ...(displayName ? { display_name: displayName.slice(0, 60) } : {}),
    memories: selectRelevantMemories(memories, message),
  };
}
