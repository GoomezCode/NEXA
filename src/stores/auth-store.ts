import { create } from 'zustand';

export type AuthRole = 'guest' | 'user' | 'admin';

export interface AuthSession {
  token: string;
  role: AuthRole;
  userId: string | null;
  username: string | null;
  /** epoch ms, já descontando 30 s de folga */
  expiresAt: number;
}

const GUEST_KEY = 'nexa:auth:guest:v1';
const SESSION_KEY = 'nexa:auth:session:v1';
const memoryOnly = import.meta.env.VITE_AUTH_STORAGE === 'memory';

function read(storage: Storage, key: string): AuthSession | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AuthSession>;
    const roleOk = value.role === 'guest' || value.role === 'user' || value.role === 'admin';

    if (
      roleOk &&
      typeof value.token === 'string' &&
      typeof value.expiresAt === 'number' &&
      value.expiresAt > Date.now()
    ) {
      return {
        token: value.token,
        role: value.role as AuthRole,
        userId: value.userId ?? null,
        username: value.username ?? null,
        expiresAt: value.expiresAt,
      };
    }
  } catch {
    // armazenamento indisponível ou JSON inválido
  }

  return null;
}

function loadInitial(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  return read(window.sessionStorage, SESSION_KEY) ?? read(window.localStorage, GUEST_KEY);
}

function persist(session: AuthSession | null): void {
  try {
    window.localStorage.removeItem(GUEST_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);

    if (!session || (memoryOnly && session.role !== 'guest')) return;

    if (session.role === 'guest') window.localStorage.setItem(GUEST_KEY, JSON.stringify(session));
    else window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sem armazenamento: a sessão vale só em memória
  }
}

interface AuthStore {
  session: AuthSession | null;
  /** 'expired' quando um usuário/admin perdeu a sessão (mostra aviso na tela de login). */
  status: 'idle' | 'expired';
  setSession: (session: AuthSession) => void;
  clear: () => void;
  markExpired: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: loadInitial(),
  status: 'idle',
  setSession: (session) => {
    persist(session);
    set({ session, status: 'idle' });
  },
  clear: () => {
    persist(null);
    set({ session: null, status: 'idle' });
  },
  markExpired: () => {
    persist(null);
    set({ session: null, status: 'expired' });
  },
}));

export function resetAuthForTests(): void {
  persist(null);
  useAuthStore.setState({ session: null, status: 'idle' });
}
