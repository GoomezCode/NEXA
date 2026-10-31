export type AiState = 'idle' | 'listening' | 'processing' | 'responding' | 'error';

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'streaming' | 'done' | 'error' | 'stopped';

export type FinishReason = 'stop' | 'length' | 'timeout' | 'tool_use';

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  status: MessageStatus;
  finish_reason?: string;
}

export interface UsageInfo {
  daily_limit: number | null;
  daily_remaining: number | null;
  per_minute_limit: number;
  per_minute_remaining: number;
  resets_at: string | null;
}

export interface ProviderUsage {
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type ChatStreamEvent =
  | { type: 'meta'; requestId?: string; model?: string }
  | { type: 'token'; value: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | {
      type: 'done';
      finishReason?: FinishReason;
      modelId?: string;
      keySource?: 'server' | 'user';
      providerUsage?: ProviderUsage;
      usage?: UsageInfo;
    }
  | { type: 'error'; code: string; message: string; requestId?: string };

export interface ChatStreamInput {
  sessionId: string;
  content: string;
  signal: AbortSignal;
  /** null/undefined = "Automático" (campo `model` omitido no corpo). */
  modelId?: string | null;
  personalization?: { display_name?: string; memories: { title: string; content: string }[] };
}

/**
 * Contrato único da conversa. O adaptador mock e o HTTP implementam esta
 * interface, permitindo trocar a origem dos dados sem alterar a UI.
 */
export interface ChatAdapter {
  listSessions(): Promise<Session[]>;
  createSession(title?: string): Promise<Session>;
  renameSession(sessionId: string, title: string): Promise<Session>;
  deleteSession(sessionId: string): Promise<void>;
  listMessages(sessionId: string): Promise<ChatMessage[]>;
  streamReply(input: ChatStreamInput): AsyncIterable<ChatStreamEvent>;
}

/** Formato de erro sugerido (RFC 9457 — Problem Details). */
export interface ApiProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
