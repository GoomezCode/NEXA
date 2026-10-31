import { create } from 'zustand';

const STORAGE_KEY = 'nexa:model:v1';

function loadSelectedModel(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

interface ModelStore {
  /** null = "Automático" (campo `model` omitido no corpo da requisição). */
  selectedModelId: string | null;
  setSelectedModel: (modelId: string | null) => void;
  reset: () => void;
}

export const useModelStore = create<ModelStore>((set) => ({
  selectedModelId: loadSelectedModel(),
  setSelectedModel: (modelId) => {
    set({ selectedModelId: modelId });

    try {
      if (modelId) window.localStorage.setItem(STORAGE_KEY, modelId);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage indisponível; a troca continua válida nesta sessão.
    }
  },
  reset: () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignora armazenamento indisponível.
    }

    set({ selectedModelId: null });
  },
}));
