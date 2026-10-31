import { create } from 'zustand';

export type ConnectionMode = 'api' | 'offline';
const STORAGE_KEY = 'nexa:connection:v1';
const DIRECT_OLLAMA_URL = 'http://localhost:11434';
const configuredOllamaUrl = (import.meta.env.VITE_OLLAMA_URL || '/ollama').trim().replace(/\/+$/, '');
const DEFAULT_OLLAMA_URL = configuredOllamaUrl === DIRECT_OLLAMA_URL ? '/ollama' : configuredOllamaUrl;
const DEFAULT_NUM_CTX = Number(import.meta.env.VITE_OLLAMA_NUM_CTX) || 4096;

function loadConnection(): { mode: ConnectionMode; ollamaUrl: string; numCtx: number } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: 'api', ollamaUrl: DEFAULT_OLLAMA_URL, numCtx: DEFAULT_NUM_CTX };
    if (raw === 'offline') return { mode: 'offline', ollamaUrl: DEFAULT_OLLAMA_URL, numCtx: DEFAULT_NUM_CTX };
    const value = JSON.parse(raw) as { mode?: unknown; ollamaUrl?: unknown; numCtx?: unknown };
    const storedUrl = typeof value.ollamaUrl === 'string' ? value.ollamaUrl.trim().replace(/\/+$/, '') : DEFAULT_OLLAMA_URL;
    // Migra a URL padrão anterior para o proxy same-origin, evitando CORS.
    const ollamaUrl = storedUrl === DIRECT_OLLAMA_URL ? DEFAULT_OLLAMA_URL : storedUrl;
    return { mode: value.mode === 'offline' ? 'offline' : 'api', ollamaUrl, numCtx: typeof value.numCtx === 'number' && value.numCtx > 0 ? value.numCtx : DEFAULT_NUM_CTX };
  } catch {
    return { mode: 'api', ollamaUrl: DEFAULT_OLLAMA_URL, numCtx: DEFAULT_NUM_CTX };
  }
}

interface ConnectionStore {
  mode: ConnectionMode;
  ollamaUrl: string;
  numCtx: number;
  setMode: (mode: ConnectionMode) => void;
  setOllamaConfig: (ollamaUrl: string, numCtx: number) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...(typeof window === 'undefined' ? { mode: 'api' as const, ollamaUrl: DEFAULT_OLLAMA_URL, numCtx: DEFAULT_NUM_CTX } : loadConnection()),
  setMode: (mode) => {
    try {
      const current = useConnectionStore.getState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, ollamaUrl: current.ollamaUrl, numCtx: current.numCtx }));
    } catch {
      // A indisponibilidade do storage não impede a troca durante esta sessão.
    }
    set({ mode });
  },
  setOllamaConfig: (ollamaUrl, numCtx) => {
    set({ ollamaUrl, numCtx });
    try { const current = useConnectionStore.getState(); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* noop */ }
  },
}));

export const isOfflineMode = (): boolean => useConnectionStore.getState().mode === 'offline';

export function resetConnectionForTests(): void {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  useConnectionStore.setState({ mode: 'api', ollamaUrl: DEFAULT_OLLAMA_URL, numCtx: DEFAULT_NUM_CTX });
}
