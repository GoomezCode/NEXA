import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@/features/chat/use-chat';
import { useCreateSession, useSessions } from '@/features/chat/api';
import { useMemories } from '@/features/memory/api';
import { useUiStore } from '@/stores/ui-store';
import { notify } from '@/stores/notification-store';
import { useSpeechRecognition } from '@/features/voice/use-speech-recognition';

export type AIState = 'idle' | 'listening' | 'processing' | 'responding' | 'error';

export interface Message {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
}

export interface MemoryItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  timestamp: Date;
  synced: boolean;
}

interface AppContextType {
  aiState: AIState;
  setAiState: (s: AIState) => void;
  messages: Message[];
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void;
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  appGridOpen: boolean;
  setAppGridOpen: (v: boolean) => void;
  scanningActive: boolean;
  setScanningActive: (v: boolean) => void;
  gestureOpen: boolean;
  setGestureOpen: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  leftPanel: 'monitor' | 'memory';
  setLeftPanel: (v: 'monitor' | 'memory') => void;
  rightPanel: 'console' | 'search';
  setRightPanel: (v: 'console' | 'search') => void;
  memories: MemoryItem[];
  isStreaming: boolean;
  sendMessage: (content: string) => Promise<void>;
  stop: () => void;
  chatError: string | null;
  sessionId: string | null;
  voiceSupported: boolean;
  voiceListening: boolean;
  voiceInterim: string;
  startVoice: () => void;
  stopVoice: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const sessions = useSessions();
  const createSession = useCreateSession();
  const sessionCreationStarted = useRef(false);
  const activeSessionId = useUiStore((state) => state.activeSessionId);
  const setActiveSessionId = useUiStore((state) => state.setActiveSessionId);
  const sessionId = activeSessionId ?? sessions.data?.[0]?.id ?? null;
  const chat = useChat(sessionId);
  const savedMemories = useMemories();
  const aiState = useUiStore((state) => state.aiState);
  const setAiState = useUiStore((state) => state.setAiState);
  const messages: Message[] = chat.messages.map((message) => ({
    id: message.id,
    type: message.role === 'user' ? 'user' : 'ai',
    text: message.content,
    timestamp: new Date(message.createdAt),
  }));
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [appGridOpen, setAppGridOpen] = useState(false);
  const [scanningActive, setScanningActive] = useState(false);
  const [gestureOpen, setGestureOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftPanel, setLeftPanel] = useState<'monitor' | 'memory'>('monitor');
  const [rightPanel, setRightPanel] = useState<'console' | 'search'>('console');
  const sendMessage = chat.sendMessage;
  const voice = useSpeechRecognition({
    onFinal: (text) => {
      const command = text.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (command === 'scan' || command === 'iniciar diagnostico' || command === 'diagnostico') setScanningActive(true);
      else if (command === 'gestos' || command === 'abrir gestos') setGestureOpen(true);
      else void sendMessage(text);
    },
    onError: (message) => notify({ tone: 'error', title: 'Entrada por voz', message }),
  });
  const memories: MemoryItem[] = (savedMemories.data ?? []).map((entry) => ({
    id: entry.id,
    title: entry.title,
    content: entry.content,
    tags: entry.tags,
    timestamp: new Date(entry.updatedAt),
    synced: false,
  }));

  useEffect(() => {
    if (!sessionId && sessions.isSuccess && !sessionCreationStarted.current) {
      sessionCreationStarted.current = true;
      void createSession.mutateAsync('NEXA Classic').then((session) => {
        setActiveSessionId(session.id);
      }).catch(() => {
        notify({ tone: 'error', title: 'Conversa', message: 'Não foi possível iniciar uma sessão. Verifique sua conexão e atualize a página.' });
      });
    } else if (sessionId && activeSessionId !== sessionId) {
      setActiveSessionId(sessionId);
    }
  }, [activeSessionId, createSession, sessionId, sessions.isSuccess, setActiveSessionId]);

  useEffect(() => {
    if (voice.listening) setAiState('listening');
    else if (useUiStore.getState().aiState === 'listening') setAiState('idle');
  }, [setAiState, voice.listening]);

  const startVoice = useCallback(() => voice.start(), [voice.start]);
  const stopVoice = useCallback(() => voice.stop(), [voice.stop]);

  const addMessage = useCallback((msg: Omit<Message, 'id' | 'timestamp'>) => {
    if (msg.type === 'user') void chat.sendMessage(msg.text);
  }, [chat]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (n: Omit<Notification, 'id'>) => {
      const id = Date.now().toString();
      setNotifications((prev) => [...prev, { ...n, id }]);
      notify({
        tone: n.type === 'error' ? 'error' : n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : 'info',
        title: n.title,
        message: n.message,
      });
      setTimeout(() => removeNotification(id), 6000);
    },
    [removeNotification],
  );

  return (
    <AppContext.Provider
      value={{
        aiState,
        setAiState,
        messages,
        addMessage,
        notifications,
        addNotification,
        removeNotification,
        appGridOpen,
        setAppGridOpen,
        scanningActive,
        setScanningActive,
        gestureOpen,
        setGestureOpen,
        settingsOpen,
        setSettingsOpen,
        leftPanel,
        setLeftPanel,
        rightPanel,
        setRightPanel,
        memories,
        isStreaming: chat.isStreaming,
        sendMessage: chat.sendMessage,
        stop: chat.stop,
        chatError: chat.error,
        sessionId,
        voiceSupported: voice.supported,
        voiceListening: voice.listening,
        voiceInterim: voice.interim,
        startVoice,
        stopVoice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
