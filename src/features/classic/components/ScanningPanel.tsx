import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, LoaderCircle, Scan, X, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { useApiHealth } from '@/api/health';
import { useModels } from '@/api/models';
import { useUsage } from '@/api/usage';
import { useSettingsStore } from '@/stores/settings-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useOllamaHealth } from '@/api/ollama';

import { useApp } from '../ClassicContext';

type CheckResult = { label: string; detail: string; ok: boolean | null };

const mono = { fontFamily: 'Share Tech Mono, monospace' };
const orb = { fontFamily: 'Orbitron, sans-serif' };

export function ScanningPanel() {
  const { scanningActive, setScanningActive } = useApp();
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const ollama = useOllamaHealth();
  const health = useApiHealth();
  const models = useModels();
  const usage = useUsage();
  const [phase, setPhase] = useState<'ready' | 'checking' | 'complete'>('ready');
  const [checks, setChecks] = useState<CheckResult[]>([]);

  useEffect(() => {
    if (!scanningActive) {
      setPhase('ready');
      setChecks([]);
      return;
    }

    let cancelled = false;
    const inspect = async () => {
      setPhase('checking');
      setChecks([]);
      const next: CheckResult[] = [];
      const append = (result: CheckResult) => {
        if (cancelled) return;
        next.push(result);
        setChecks([...next]);
      };

      if (offlineMode) {
        const ollamaResult = await ollama.refetch();
        append({ label: 'OLLAMA LOCAL', detail: ollamaResult.isError ? 'Ollama indisponível; inicie ollama serve.' : `Ollama ${ollamaResult.data ?? 'conectado'}`, ok: !ollamaResult.isError });
        const modelResult = await models.refetch();
        append({ label: 'MODELOS INSTALADOS', detail: modelResult.isError ? 'Não foi possível consultar o catálogo local.' : `${modelResult.data?.models.length ?? 0} modelos locais`, ok: !modelResult.isError && (modelResult.data?.models.length ?? 0) > 0 });
      } else if (demoMode) {
        append({ label: 'MODO DE EXECUÇÃO', detail: 'Demonstração local ativa; nenhuma chamada à API foi feita.', ok: null });
      } else {
        const healthResult = await health.refetch();
        append({
          label: 'SAÚDE DA API',
          detail: healthResult.data?.status === 'ok'
            ? `API conectada${healthResult.data.version ? ` · v${healthResult.data.version}` : ''}`
            : healthResult.data?.message ?? 'API indisponível ou degradada.',
          ok: !healthResult.isError && healthResult.data?.status === 'ok',
        });

        const modelResult = await models.refetch();
        const available = modelResult.data?.providers.filter((provider) => provider.available).length ?? 0;
        append({
          label: 'CATÁLOGO DE MODELOS',
          detail: modelResult.isError ? 'Não foi possível consultar os modelos.' : `${modelResult.data?.models.length ?? 0} modelos · ${available} provedores disponíveis`,
          ok: !modelResult.isError && (modelResult.data?.models.length ?? 0) > 0,
        });

        const usageResult = await usage.refetch();
        append({
          label: 'USO E COTA',
          detail: usageResult.isError ? 'Não foi possível consultar a cota desta sessão.' : usageResult.data?.daily_remaining == null ? 'Cota diária não informada pelo servidor.' : `${usageResult.data.daily_remaining} mensagens restantes hoje`,
          ok: !usageResult.isError,
        });
      }

      if (!cancelled) setPhase('complete');
    };

    void inspect();
    return () => { cancelled = true; };
  }, [demoMode, offlineMode, health.refetch, models.refetch, ollama.refetch, scanningActive, usage.refetch]);

  const progress = phase === 'ready' ? 0 : phase === 'complete' ? 100 : Math.min(checks.length * (demoMode ? 100 : 34), 92);

  return (
    <AnimatePresence>
      {scanningActive && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-4 sm:p-8"
          style={{ background: 'rgba(0, 5, 15, .92)', backdropFilter: 'blur(10px)' }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) setScanningActive(false); }}
        >
          <motion.section
            role="dialog" aria-modal="true" aria-labelledby="classic-scan-title"
            initial={{ opacity: 0, scale: .94, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#06111f]/95 shadow-[0_0_60px_rgba(0,245,255,.12)]"
          >
            <header className="flex items-center justify-between gap-4 border-b border-cyan-300/10 px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <motion.div animate={{ rotate: phase === 'checking' ? 360 : 0 }} transition={{ duration: 2, repeat: phase === 'checking' ? Infinity : 0, ease: 'linear' }}>
                  <Scan className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                </motion.div>
                <div><h2 id="classic-scan-title" style={{ ...orb, letterSpacing: '.14em' }} className="text-sm text-cyan-200">DIAGNÓSTICO NEXA</h2><p style={mono} className="text-2xs text-cyan-100/45">CONSULTAS REAIS DA SESSÃO</p></div>
              </div>
              <div className="flex items-center gap-3">
                <span role="status" style={mono} className="text-2xs uppercase text-cyan-100/70">{phase === 'ready' ? 'PRONTO' : phase === 'checking' ? 'CONSULTANDO' : 'CONCLUÍDO'}</span>
                <motion.button type="button" whileHover={{ scale: 1.08, rotate: 90 }} whileTap={{ scale: .9 }} aria-label="Fechar diagnóstico" onClick={() => setScanningActive(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-300/20 text-red-200"><X className="h-4 w-4" /></motion.button>
              </div>
            </header>

            <div className="grid gap-5 p-5 sm:grid-cols-[220px_1fr] sm:p-7">
              <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-cyan-200/10 bg-[#020914]">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(0,245,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,.08) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <motion.div animate={{ scale: phase === 'checking' ? [1, 1.16, 1] : 1, opacity: phase === 'checking' ? [.55, 1, .55] : .7 }} transition={{ duration: 1.6, repeat: phase === 'checking' ? Infinity : 0 }} className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full border border-cyan-300/40 text-cyan-200 shadow-[0_0_32px_rgba(0,245,255,.16)]">
                  <Activity className="h-9 w-9" aria-hidden="true" />
                </motion.div>
                {phase === 'checking' && <motion.div initial={{ y: '-100%' }} animate={{ y: '240%' }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }} className="absolute left-0 right-0 z-20 h-8 bg-gradient-to-b from-transparent via-cyan-300/20 to-transparent" />}
                <span className="absolute bottom-3 z-10" style={mono} aria-label={`Progresso ${progress}%`}><span className="text-xs text-cyan-200">{progress}%</span></span>
              </div>

              <div className="space-y-3">
                <div><div className="mb-1 flex justify-between" style={mono}><span className="text-2xs text-white/40">VERIFICAÇÕES</span><span className="text-2xs text-cyan-200">{checks.length}/{offlineMode ? 2 : demoMode ? 1 : 3}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/5"><motion.div animate={{ width: `${progress}%` }} transition={{ duration: .45 }} className="h-full rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(0,245,255,.8)]" /></div></div>
                <div className="space-y-2" aria-live="polite">
                  {checks.map((check, index) => (
                    <motion.article key={check.label} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .05 }} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[.025] p-3">
                      {check.ok === null ? <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" /> : check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />}
                      <div className="min-w-0"><h3 style={mono} className="text-2xs text-white/75">{check.label}</h3><p className="mt-0.5 text-xs leading-relaxed text-white/45">{check.detail}</p></div>
                    </motion.article>
                  ))}
                  {phase === 'checking' && <div role="status" className="flex items-center gap-2 px-1 py-2 text-xs text-cyan-100/50"><LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Verificando serviços configurados…</div>}
                  {phase === 'ready' && <p className="text-xs leading-relaxed text-white/45">{offlineMode ? 'Este diagnóstico verifica o Ollama local e os modelos instalados.' : 'Este diagnóstico consulta o estado da API, o catálogo de modelos e a cota da sessão. Ele não executa testes de segurança nem altera configurações.'}</p>}
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
