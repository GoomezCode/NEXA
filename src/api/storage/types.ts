import type { ChatMessage, Session } from '../types';

export interface ChatSnapshot {
  sessions: Session[];
  messages: Record<string, ChatMessage[]>;
}

/** Armazenamento opcional para o adaptador de demonstração. */
export interface ChatStorage {
  load(): Promise<ChatSnapshot | null>;
  save(snapshot: ChatSnapshot): Promise<void>;
}
