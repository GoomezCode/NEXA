import { create } from 'zustand';

export interface ResponseMetric {
  inputTokens?: number;
  outputTokens?: number;
  firstTokenMs?: number;
  durationMs: number;
  tokensPerSecond?: number;
  finishReason?: string;
  modelId?: string;
  keySource?: 'server' | 'user';
  recordedAt: number;
}

interface SessionMetricsStore {
  bySession: Record<string, ResponseMetric[]>;
  record: (sessionId: string, metric: ResponseMetric) => void;
}

const KEY = 'nexa:session-metrics:v1';
function load(): Record<string, ResponseMetric[]> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<string, ResponseMetric[]>; }
  catch { return {}; }
}

export const useSessionMetricsStore = create<SessionMetricsStore>((set, get) => ({
  bySession: load(),
  record: (sessionId, metric) => {
    const bySession = { ...get().bySession, [sessionId]: [...(get().bySession[sessionId] ?? []), metric].slice(-100) };
    try { sessionStorage.setItem(KEY, JSON.stringify(bySession)); } catch { /* sessão volátil */ }
    set({ bySession });
  },
}));
