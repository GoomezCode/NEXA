import { create } from 'zustand';

export type InterfaceMode = 'nexa' | 'classic';

const STORAGE_KEY = 'nexa.interface-mode';
const FORCED_PARAM = 'ui';

function readForcedMode(): InterfaceMode | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(FORCED_PARAM);

  if (value === 'classic' || value === 'nexa') {
    return value;
  }

  return null;
}

function readStoredMode(): InterfaceMode {
  const forced = readForcedMode();

  if (forced) {
    return forced;
  }

  if (typeof window === 'undefined') {
    return 'nexa';
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === 'classic' || stored === 'nexa') {
      return stored;
    }
  } catch {
    // Armazenamento bloqueado: segue com o modo padrão.
  }

  return 'nexa';
}

interface InterfaceModeStore {
  mode: InterfaceMode;
  forced: boolean;
  setMode: (mode: InterfaceMode) => void;
  toggleMode: () => void;
}

export const useInterfaceModeStore = create<InterfaceModeStore>((set, get) => ({
  mode: readStoredMode(),
  forced: readForcedMode() !== null,
  setMode: (mode) => {
    if (get().mode === mode) {
      return;
    }

    if (!get().forced) {
      try {
        window.localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // Sem persistência disponível; a troca continua válida nesta sessão.
      }
    }

    set({ mode });
  },
  toggleMode: () => {
    get().setMode(get().mode === 'nexa' ? 'classic' : 'nexa');
  },
}));

export function resetInterfaceModeForTests(): void {
  useInterfaceModeStore.setState({ mode: 'nexa', forced: false });
}
