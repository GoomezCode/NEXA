import { useState } from 'react';
import { Activity, Cpu, Database, KeyRound, Wifi } from 'lucide-react';
import { motion } from 'motion/react';

import { useApiHealth } from '@/api/health';
import { useModels } from '@/api/models';
import { useUsage } from '@/api/usage';
import { useSettingsStore } from '@/stores/settings-store';
import { ApiLetter } from '@/features/monitor/ApiLetter';
import { ProviderKeysPanel } from '@/features/monitor/ProviderKeysPanel';
import { useConnectionStore } from '@/stores/connection-store';
import { useOllamaHealth } from '@/api/ollama';
import { useEffect } from 'react';

const orb = { fontFamily: 'Orbitron, sans-serif' };
const mono = { fontFamily: 'Share Tech Mono, monospace' };
const raj = { fontFamily: 'Rajdhani, sans-serif' };

export function SystemMonitor() {
  const [view, setView] = useState<'status' | 'providers'>('status');
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const ollama = useOllamaHealth();
  const health = useApiHealth();
  const usage = useUsage();
  const models = useModels();
  const online = !demoMode && health.data?.status === 'ok';
  const daily = usage.data?.daily_limit;
  const dailyUsed = daily !== null && daily !== undefined && usage.data?.daily_remaining !== null
    ? daily - (usage.data?.daily_remaining ?? daily)
    : null;
  const metrics = [
    { label: offlineMode ? 'OLLAMA' : 'API', value: offlineMode ? ollama.isError ? 'OFFLINE' : ollama.data ? 'ONLINE' : '…' : demoMode ? 'DEMO' : health.isLoading ? '…' : health.data?.status?.toUpperCase() ?? 'OFFLINE', icon: Wifi, color: offlineMode ? ollama.isError ? '#f59e0b' : '#22c55e' : online ? '#22c55e' : '#f59e0b' },
    { label: 'MODELOS', value: models.data?.models.length.toString() ?? '—', icon: Cpu, color: '#00f5ff' },
    ...(!offlineMode ? [{ label: 'PROVEDORES', value: models.data?.providers.filter((item) => item.available).length.toString() ?? '—', icon: Activity, color: '#a855f7' }, { label: 'USO DIÁRIO', value: dailyUsed === null ? '—' : `${dailyUsed}/${daily}`, icon: Database, color: '#0ea5e9' }] : []),
  ];
  useEffect(() => { if (offlineMode) setView('status'); }, [offlineMode]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span style={{ ...orb, color: '#00f5ff', fontSize: '11px', letterSpacing: '0.15em' }}>SYSTEM STATUS</span>
        </div>
        <button type="button" onClick={() => { void health.refetch(); void usage.refetch(); void models.refetch(); }} style={{ ...mono, color: '#00f5ff', fontSize: '9px' }}>
          ATUALIZAR
        </button>
      </div>
      <div role="tablist" aria-label="Seções do monitor" className="flex gap-1 rounded-lg border border-white/5 bg-black/15 p-1">
        {(!offlineMode ? ([
          ['status', 'STATUS', Activity],
          ['providers', 'IA E CHAVES', KeyRound],
        ] as const) : ([['status', 'OLLAMA LOCAL', Activity]] as const)).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-2 font-mono text-[8px] tracking-wider transition" style={{ color: view === id ? '#00f5ff' : 'rgba(255,255,255,.42)', background: view === id ? 'rgba(0,245,255,.1)' : 'transparent' }}><Icon className="h-3 w-3" aria-hidden="true" />{label}</button>
        ))}
      </div>
      {view === 'providers' && !offlineMode ? (
        <div role="tabpanel" className="space-y-3 pb-2">
          <ProviderKeysPanel compact />
          <ApiLetter />
        </div>
      ) : (
        <div role="tabpanel" className="flex flex-col gap-3">
      <div className="rounded-xl p-3" style={{ background: 'rgba(0,8,20,0.5)', border: `1px solid ${online ? '#22c55e' : '#f59e0b'}30` }}>
        <div className="flex items-center gap-3">
          <motion.span animate={{ opacity: [1, 0.45, 1] }} transition={{ duration: 1.8, repeat: Infinity }} className="h-2 w-2 rounded-full" style={{ background: online ? '#22c55e' : '#f59e0b' }} />
          <div>
            <p style={{ ...raj, color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>{offlineMode ? ollama.isError ? 'Ollama indisponível' : ollama.data ? 'Ollama local conectado' : 'Consultando Ollama' : demoMode ? 'Modo demonstração' : health.data?.status === 'ok' ? 'API conectada' : health.isLoading ? 'Consultando API' : 'API indisponível'}</p>
            <p style={{ ...mono, color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>{offlineMode ? ollama.data ? `VERSÃO ${ollama.data}` : 'Inicie o serviço com ollama serve' : health.data?.version ? `VERSÃO ${health.data.version}` : health.data?.message ?? 'Métricas vêm da API configurada'}</p>
          </div>
        </div>
      </div>
      {metrics.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="flex items-center justify-between rounded-xl p-3" style={{ background: 'rgba(0,8,20,0.5)', border: `1px solid ${color}25` }}>
          <div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" style={{ color }} /><span style={{ ...mono, color: 'rgba(255,255,255,0.5)', fontSize: '9px' }}>{label}</span></div>
          <span style={{ ...orb, color, fontSize: '11px' }}>{value}</span>
        </div>
      ))}
      {models.data?.providers.map((provider) => (
        <div key={`${provider.provider}-${provider.key_source}`} className="flex items-center justify-between px-2">
          <span style={{ ...raj, color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>{provider.name}</span>
          <span style={{ ...mono, color: provider.available ? '#22c55e' : '#f59e0b', fontSize: '8px' }}>{provider.available ? 'DISPONÍVEL' : 'INDISPONÍVEL'}</span>
        </div>
      ))}
        </div>
      )}
    </div>
  );
}
