import '@fontsource/share-tech-mono/400.css';

import './classic.css';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Terminal, Search, Activity } from 'lucide-react';

import { AppProvider, useApp } from './ClassicContext';
import { Background } from './components/Background';
import { TopBar } from './components/TopBar';
import { AICore } from './components/AICore';
import { SystemMonitor } from './components/SystemMonitor';
import { MemoryPanel } from './components/MemoryPanel';
import { CommandConsole } from './components/CommandConsole';
import { SearchPanel } from './components/SearchPanel';
import { VoiceBar } from './components/VoiceBar';
import { AppGrid } from './components/AppGrid';
import { AppDock } from './components/AppDock';
import { SettingsPanel } from './components/SettingsPanel';
import { ScanningPanel } from './components/ScanningPanel';
import { GesturePanel } from './components/GesturePanel';
import { NotificationSystem } from './components/NotificationSystem';
import { useModels } from '@/api/models';
import { useUsage } from '@/api/usage';
import { useModelStore } from '@/stores/model-store';
import { useSessionMetricsStore } from '@/stores/session-metrics-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useLayoutClass } from '@/hooks/use-layout-class';
import { useVisualViewport } from '@/hooks/use-visual-viewport';

const orb = { fontFamily: 'Orbitron, sans-serif' };
const mono = { fontFamily: 'Share Tech Mono, monospace' };

const glassPanel = (accent = '#00f5ff') => ({
  background: 'rgba(0, 10, 28, 0.65)',
  backdropFilter: 'blur(20px)',
  border: `1px solid ${accent}20`,
  borderRadius: '16px',
  boxShadow: `0 0 30px rgba(0,0,0,0.4), inset 0 0 20px rgba(0,0,0,0.3)`,
});

function PanelTab({
  label,
  icon: Icon,
  active,
  color,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer"
      style={{
        background: active ? `${color}12` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${active ? `${color}35` : 'rgba(255,255,255,0.06)'}`,
        transition: 'all 0.2s',
      }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: active ? color : 'rgba(255,255,255,0.3)' }} />
      <span
        style={{
          ...mono,
          color: active ? color : 'rgba(255,255,255,0.35)',
          fontSize: '0.6875rem',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
    </motion.button>
  );
}

function MainLayout({ onExit }: { onExit: () => void }) {
  useVisualViewport();
  const {
    leftPanel,
    setLeftPanel,
    rightPanel,
    setRightPanel,
    activePanel,
    setActivePanel,
    sessionId,
    settingsOpen,
    setSettingsOpen,
    appGridOpen,
    setAppGridOpen,
    scanningActive,
    setScanningActive,
    gestureOpen,
    setGestureOpen,
    conversationOpen,
    setConversationOpen,
  } = useApp();
  const selectedModelId = useModelStore((state) => state.selectedModelId);
  const modelCatalog = useModels();
  const usage = useUsage();
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const latestMetric = useSessionMetricsStore((state) =>
    sessionId ? state.bySession[sessionId]?.at(-1) : undefined,
  );
  const selectedModel = modelCatalog.data?.models.find((model) => model.model_id === selectedModelId);
  const layout = useLayoutClass();

  useEffect(() => {
    if (!settingsOpen && !appGridOpen && !scanningActive && !gestureOpen && !conversationOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (settingsOpen) {
        setSettingsOpen(false);
      }

      if (appGridOpen) {
        setAppGridOpen(false);
      }
      if (scanningActive) setScanningActive(false);
      if (gestureOpen) setGestureOpen(false);
      if (conversationOpen) setConversationOpen(false);

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appGridOpen, conversationOpen, gestureOpen, scanningActive, setAppGridOpen, setConversationOpen, setGestureOpen, setScanningActive, setSettingsOpen, settingsOpen]);

  return (
    <div
      className={`classic-layout classic-layout--${layout.layout}${layout.short ? ' classic-layout--short' : ''} fixed inset-0 flex flex-col overflow-hidden`}
      data-active-panel={activePanel}
      style={{ fontFamily: 'Rajdhani, sans-serif' }}
    >
      <Background />

      {/* Top Bar */}
      <TopBar onExit={onExit} />

      <nav className="classic-compact-tabs" aria-label="Painéis do modo clássico">
        {([
          ['console', 'CONSOLE', Terminal],
          ['monitor', 'MONITOR', Activity],
          ['memory', 'MEMORY', Brain],
          ['search', 'SEARCH', Search],
        ] as const).map(([panel, label, Icon]) => (
          <button
            key={panel}
            type="button"
            aria-pressed={activePanel === panel}
            onClick={() => setActivePanel(panel)}
            className={activePanel === panel ? 'is-active' : ''}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <nav className="classic-medium-tabs" aria-label="Painéis do modo clássico">
        {([
          ['console', 'CONSOLE', Terminal],
          ['monitor', 'MONITOR', Activity],
          ['memory', 'MEMORY', Brain],
          ['search', 'SEARCH', Search],
        ] as const).map(([panel, label, Icon]) => (
          <button
            key={panel}
            type="button"
            aria-pressed={activePanel === panel}
            onClick={() => setActivePanel(panel)}
            className={activePanel === panel ? 'is-active' : ''}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Main 3-column layout */}
      <div
        className="classic-main-area flex flex-1 gap-4 px-4 overflow-hidden"
        style={{ marginTop: 'var(--c-main-top, 3.5rem)', marginBottom: 'var(--c-main-bottom, 9rem)' }}
      >
        {/* LEFT PANEL */}
        <div className="classic-panel classic-panel--left w-72 flex-shrink-0 flex flex-col gap-3 overflow-hidden pt-4 pb-2">
          {/* Panel tabs */}
          <div className="flex gap-2 flex-shrink-0">
            <PanelTab
              id="monitor"
              label="MONITOR"
              icon={Activity}
              active={leftPanel === 'monitor'}
              color="#00f5ff"
              onClick={() => setLeftPanel('monitor')}
            />
            <PanelTab
              id="memory"
              label="MEMORY"
              icon={Brain}
              active={leftPanel === 'memory'}
              color="#a855f7"
              onClick={() => setLeftPanel('memory')}
            />
          </div>

          {/* Panel content */}
          <div
            className="flex-1 p-4 overflow-hidden"
            style={glassPanel(leftPanel === 'monitor' ? '#00f5ff' : '#a855f7')}
          >
            <AnimatePresence mode="wait">
              {leftPanel === 'monitor' ? (
                <motion.div
                  key="monitor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <SystemMonitor />
                </motion.div>
              ) : (
                <motion.div
                  key="memory"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <MemoryPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* CENTER — AI Core */}
        <div className="classic-center flex-1 flex flex-col items-center justify-center gap-4 overflow-hidden">
          {/* Top data strip */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md flex items-center justify-between px-6 py-2.5 rounded-xl flex-shrink-0"
            style={{
              background: 'rgba(0,8,22,0.5)',
              border: '1px solid rgba(0,245,255,0.1)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {[
              { label: 'MODELO', value: selectedModel?.name ?? selectedModelId ?? 'AUTO', color: '#00f5ff' },
              { label: 'JANELA', value: selectedModel?.context_window ? `${Math.round(selectedModel.context_window / 1000)}K` : '—', color: '#a855f7' },
              ...(!offlineMode ? [{ label: 'COTA DIA', value: usage.data?.daily_remaining == null ? '—' : `${usage.data.daily_remaining}`, color: '#22c55e' }] : []),
              { label: '1º TOKEN', value: latestMetric?.firstTokenMs == null ? '—' : `${Math.round(latestMetric.firstTokenMs)}ms`, color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-center">
                <span style={{ ...orb, color, fontSize: '13px', textShadow: `0 0 8px ${color}` }}>
                  {value}
                </span>
                <span style={{ ...mono, color: 'rgba(255,255,255,0.3)', fontSize: '0.6875rem' }}>
                  {label}
                </span>
              </div>
            ))}
          </motion.div>

          {/* AI Core orb */}
          <div className="flex-1 flex items-center justify-center w-full">
            <AICore />
          </div>

          {/* Bottom info strip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm flex flex-col gap-2 flex-shrink-0"
          >
            {/* Quick action buttons */}
            <div className="flex items-center justify-center gap-3">
              {[
                { label: 'SCAN', color: '#00f5ff', action: 'scan' },
                { label: 'ANALYZE', color: '#a855f7', action: 'analyze' },
                { label: 'MEMORY', color: '#22c55e', action: 'memory' },
                { label: 'SUMMARY', color: '#f59e0b', action: 'summary' },
              ].map(({ label, color, action }) => (
                <QuickActionButton key={label} label={label} color={color} action={action} />
              ))}
            </div>
          </motion.div>
        </div>

        {/* RIGHT PANEL */}
        <div className="classic-panel classic-panel--right w-72 flex-shrink-0 flex flex-col gap-3 overflow-hidden pt-4 pb-2">
          {/* Panel tabs */}
          <div className="flex gap-2 flex-shrink-0">
            <PanelTab
              id="console"
              label="CONSOLE"
              icon={Terminal}
              active={rightPanel === 'console'}
              color="#00f5ff"
              onClick={() => setRightPanel('console')}
            />
            <PanelTab
              id="search"
              label="SEARCH"
              icon={Search}
              active={rightPanel === 'search'}
              color="#0ea5e9"
              onClick={() => setRightPanel('search')}
            />
          </div>

          {/* Panel content */}
          <div
            className="flex-1 p-4 overflow-hidden"
            style={glassPanel(rightPanel === 'console' ? '#00f5ff' : '#0ea5e9')}
          >
            <AnimatePresence mode="wait">
              {rightPanel === 'console' ? (
                <motion.div
                  key="console"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <CommandConsole />
                </motion.div>
              ) : (
                <motion.div
                  key="search"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <SearchPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Voice Bar */}
      <VoiceBar />

      {/* App Dock */}
      <AppDock />

      {conversationOpen && (
        <div className="classic-mobile-chat-overlay" role="dialog" aria-modal="true" aria-label="Conversa com a NEXA">
          <div className="classic-mobile-chat-window">
            <CommandConsole conversationMode />
          </div>
        </div>
      )}

      {/* Overlays */}
      <AppGrid />
      <SettingsPanel />
      <ScanningPanel />
      <GesturePanel />

      {/* Notifications */}
      <NotificationSystem />
    </div>
  );
}

function QuickActionButton({
  label,
  color,
  action,
}: {
  label: string;
  color: string;
  action: string;
}) {
  const { sendMessage, isStreaming, setScanningActive } = useApp();

  const handleClick = () => {
    if (isStreaming) return;
    if (action === 'scan') {
      setScanningActive(true);
      return;
    }
    const prompts: Record<string, string> = {
      status: 'Resuma o estado desta conversa e diga se há algum contexto que ainda falta.',
      analyze: 'Analise minha solicitação mais recente e proponha próximos passos concretos.',
      memory: 'Use as memórias ativas do meu perfil para contextualizar sua resposta.',
      summary: 'Faça um resumo conciso desta conversa.',
    };
    void sendMessage(prompts[action] ?? action);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      disabled={isStreaming}
      className="px-4 py-2 rounded-xl cursor-pointer"
      style={{
        background: `${color}0a`,
        border: `1px solid ${color}30`,
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${color}25`)
      }
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}
    >
        <span style={{ ...mono, color, fontSize: '0.6875rem', letterSpacing: '0.08em' }}>{label}</span>
    </motion.button>
  );
}

export default function ClassicApp({ onExit }: { onExit: () => void }) {
  return (
    <div className="classic-hud">
      <AppProvider>
        <MainLayout onExit={onExit} />
      </AppProvider>
    </div>
  );
}
