import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Wifi,
  Shield,
  Cpu,
  Settings,
  Grid,
  Bell,
  Activity,
  LayoutDashboard,
  Hand,
  LogOut,
} from 'lucide-react';
import { useApiHealth } from '@/api/health';
import { useModels } from '@/api/models';
import { useUsage } from '@/api/usage';
import { useSettingsStore } from '@/stores/settings-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useOllamaHealth } from '@/api/ollama';
import { useAuthStore } from '@/stores/auth-store';
import { useApp } from '../ClassicContext';

const orb = { fontFamily: 'Orbitron, sans-serif' };
const mono = { fontFamily: 'Share Tech Mono, monospace' };
const raj = { fontFamily: 'Rajdhani, sans-serif' };

export function TopBar({ onExit }: { onExit: () => void }) {
  const [time, setTime] = useState(new Date());
  const { setSettingsOpen, setAppGridOpen, setGestureOpen, aiState, addNotification } = useApp();
  const health = useApiHealth();
  const models = useModels();
  const usage = useUsage();
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const ollama = useOllamaHealth();

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { hour12: false });
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const stateColor = {
    idle: '#00f5ff',
    listening: '#22c55e',
    processing: '#f59e0b',
    responding: '#a855f7',
    error: '#ef4444',
  }[aiState];

  const stateLabel = {
    idle: 'STANDBY',
    listening: 'LISTENING',
    processing: 'PROCESSING',
    responding: 'RESPONDING',
    error: 'ERROR',
  }[aiState];

  return (
    <div
      className="classic-topbar fixed top-0 left-0 right-0 h-14 flex items-center px-5 gap-4"
      style={{
        zIndex: 100,
        background: 'rgba(1, 11, 26, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0, 245, 255, 0.15)',
        boxShadow: '0 0 30px rgba(0, 245, 255, 0.04), 0 1px 0 rgba(0,245,255,0.08)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 rounded-full flex items-center justify-center relative"
          style={{
            border: '1.5px solid rgba(0,245,255,0.6)',
            boxShadow: '0 0 12px rgba(0,245,255,0.4), inset 0 0 8px rgba(0,245,255,0.1)',
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: '#00f5ff', boxShadow: '0 0 8px rgba(0,245,255,0.9)' }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{ border: '1px dashed rgba(0,245,255,0.2)' }}
          />
        </motion.div>
        <div>
          <div
            style={{
              ...orb,
              color: '#00f5ff',
              fontSize: '13px',
              letterSpacing: '0.15em',
              textShadow: '0 0 10px rgba(0,245,255,0.6)',
            }}
          >
            NEXA AI
          </div>
          <div style={{ ...mono, color: 'rgba(0,245,255,0.45)', fontSize: '10px' }}>
            OS v3.7.2 — ALPHA
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 flex-shrink-0" style={{ background: 'rgba(0,245,255,0.12)' }} />

      {/* AI State */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <motion.div
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: aiState === 'idle' ? 3 : 0.6, repeat: Infinity }}
          className="w-2 h-2 rounded-full"
          style={{ background: stateColor, boxShadow: `0 0 8px ${stateColor}` }}
        />
        <span style={{ ...mono, color: stateColor, fontSize: '11px', letterSpacing: '0.12em' }}>
          {stateLabel}
        </span>
      </div>

      {/* Center status row */}
      <div className="flex-1 flex items-center justify-center gap-6">
        {[
          { icon: Wifi, label: offlineMode ? 'OLLAMA' : 'API', val: offlineMode ? ollama.isError ? 'OFFLINE' : ollama.data ? 'ONLINE' : '…' : demoMode ? 'DEMO' : health.data?.status?.toUpperCase() ?? '—', color: offlineMode ? ollama.isError ? '#f59e0b' : '#22c55e' : health.data?.status === 'ok' ? '#22c55e' : '#f59e0b' },
          { icon: Cpu, label: 'MODELOS', val: models.data?.models.length.toString() ?? '—', color: '#a855f7' },
          ...(!offlineMode ? [{ icon: Activity, label: 'PROVEDORES', val: models.data?.providers.filter((item) => item.available).length.toString() ?? '—', color: '#0ea5e9' }, { icon: Shield, label: 'COTA', val: usage.data?.daily_remaining == null ? '—' : `${usage.data.daily_remaining}`, color: '#00f5ff' }] : []),
        ].map(({ icon: Icon, label, val, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon className="w-3 h-3" style={{ color }} />
            <span style={{ ...mono, color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
              {label}
            </span>
            <span style={{ ...mono, color, fontSize: '10px' }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Time */}
      <div className="text-right flex-shrink-0">
        <div
          style={{
            ...orb,
            color: '#00f5ff',
            fontSize: '15px',
            textShadow: '0 0 10px rgba(0,245,255,0.5)',
          }}
        >
          {fmtTime(time)}
        </div>
        <div style={{ ...raj, color: 'rgba(0,245,255,0.5)', fontSize: '10px' }}>
          {fmtDate(time)}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 flex-shrink-0" style={{ background: 'rgba(0,245,255,0.12)' }} />

      {/* Quick actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {[
          {
            icon: Bell,
            label: 'System alerts',
            action: () =>
              addNotification({
                type: 'info',
                title: offlineMode ? 'Estado do Ollama' : 'Estado da API',
                message: offlineMode ? ollama.isError ? 'Ollama indisponível; inicie ollama serve.' : `Ollama ${ollama.data ?? 'verificando'}. ${models.data?.models.length ?? 0} modelos locais.` : demoMode ? 'Modo demonstração ativo.' : health.data?.message ?? `API ${health.data?.status ?? 'sem resposta'}; ${models.data?.providers.length ?? 0} provedores listados.`,
              }),
            color: '#f59e0b',
          },
          { icon: Grid, label: 'Apps', action: () => setAppGridOpen(true), color: '#00f5ff' },
          { icon: Hand, label: 'Controles gestuais (prévia)', action: () => setGestureOpen(true), color: '#00f5ff' },
          {
            icon: Settings,
            label: 'Settings',
            action: () => setSettingsOpen(true),
            color: '#00f5ff',
          },
          ...(offlineMode ? [{ icon: LogOut, label: 'Sair do offline', action: () => { useConnectionStore.getState().setMode('api'); useAuthStore.getState().clear(); }, color: '#f59e0b' }] : []),
          { icon: LayoutDashboard, label: 'Voltar ao NEXA HUD', action: onExit, color: '#a855f7' },
        ].map(({ icon: Icon, label, action, color }, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={action}
            aria-label={label}
            title={label}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{
              background: 'rgba(0,245,255,0.04)',
              border: '1px solid rgba(0,245,255,0.15)',
              transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${color}40`;
              (e.currentTarget as HTMLElement).style.borderColor = `${color}60`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,245,255,0.15)';
            }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
