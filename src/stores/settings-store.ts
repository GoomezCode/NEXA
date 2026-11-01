import { create } from 'zustand';
import { appEnv } from '@/lib/env';

export interface AppSettings {
  displayName: string;
  theme: 'hud' | 'violet' | 'classic' | 'light' | 'contrast';
  voiceInputEnabled: boolean;
  ttsEnabled: boolean;
  speechRate: number;
  speechVoiceURI: string;
  reducedMotion: boolean;
  effectsMode: 'auto' | 'full' | 'balanced' | 'lite';
  apiUrl: string;
  demoMode: boolean;
}

const STORAGE_KEY = 'nexa:settings:v1';

export const DEFAULT_SETTINGS: AppSettings = {
  displayName: '',
  theme: 'hud',
  voiceInputEnabled: true,
  ttsEnabled: false,
  speechRate: 1,
  speechVoiceURI: '',
  reducedMotion: false,
  effectsMode: 'auto',
  apiUrl: appEnv.apiUrl,
  demoMode: appEnv.demoMode,
};

function sanitizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const candidate = value as Partial<Record<keyof AppSettings, unknown>>;
  const rate = Number(candidate.speechRate);

  return {
    displayName:
      candidate.displayName === 'Operador'
        ? ''
        : typeof candidate.displayName === 'string'
          ? candidate.displayName.slice(0, 60)
          : DEFAULT_SETTINGS.displayName,
    theme: ['hud', 'violet', 'classic', 'light', 'contrast'].includes(String(candidate.theme))
      ? (candidate.theme as AppSettings['theme'])
      : DEFAULT_SETTINGS.theme,
    voiceInputEnabled:
      typeof candidate.voiceInputEnabled === 'boolean'
        ? candidate.voiceInputEnabled
        : DEFAULT_SETTINGS.voiceInputEnabled,
    ttsEnabled:
      typeof candidate.ttsEnabled === 'boolean'
        ? candidate.ttsEnabled
        : DEFAULT_SETTINGS.ttsEnabled,
    speechRate: Number.isFinite(rate)
      ? Math.min(2, Math.max(0.5, rate))
      : DEFAULT_SETTINGS.speechRate,
    speechVoiceURI: typeof candidate.speechVoiceURI === 'string' ? candidate.speechVoiceURI.slice(0, 300) : '',
    reducedMotion:
      typeof candidate.reducedMotion === 'boolean'
        ? candidate.reducedMotion
        : DEFAULT_SETTINGS.reducedMotion,
    effectsMode: ['auto', 'full', 'balanced', 'lite'].includes(String(candidate.effectsMode))
      ? (candidate.effectsMode as AppSettings['effectsMode'])
      : DEFAULT_SETTINGS.effectsMode,
    apiUrl:
      typeof candidate.apiUrl === 'string' && candidate.apiUrl.trim()
        ? candidate.apiUrl.trim()
        : DEFAULT_SETTINGS.apiUrl,
    demoMode:
      typeof candidate.demoMode === 'boolean' ? candidate.demoMode : DEFAULT_SETTINGS.demoMode,
  };
}

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Sem armazenamento disponível; mantém apenas em memória.
  }
}

interface SettingsStore {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: loadSettings(),
  update: (patch) => {
    const next = sanitizeSettings({ ...get().settings, ...patch });
    persistSettings(next);
    set({ settings: next });
  },
  reset: () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignora armazenamento indisponível.
    }

    set({ settings: { ...DEFAULT_SETTINGS } });
  },
}));

export function getSettingsSnapshot(): AppSettings {
  return useSettingsStore.getState().settings;
}

export function resetSettingsForTests(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignora armazenamento indisponível.
  }

  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
}
