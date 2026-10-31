import { useState } from 'react';
import { Activity, ArrowUpRight, Brain, Grid2X2, MessageSquare, Monitor, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { useApp } from '../ClassicContext';

const mono = { fontFamily: 'Share Tech Mono, monospace' };
const orb = { fontFamily: 'Orbitron, sans-serif' };

const shortcuts = [
  { id: 'monitor', label: 'Abrir monitor', detail: 'Ver saúde, modelos e uso da API', icon: Monitor, color: '#00f5ff' },
  { id: 'memory', label: 'Abrir memórias', detail: 'Consultar e gerenciar suas memórias', icon: Brain, color: '#a855f7' },
  { id: 'chat', label: 'Abrir conversa', detail: 'Voltar ao console de conversa', icon: MessageSquare, color: '#22c55e' },
  { id: 'apps', label: 'Abrir aplicativos', detail: 'Mostrar os atalhos disponíveis', icon: Grid2X2, color: '#f59e0b' },
] as const;

export function GesturePanel() {
  const { gestureOpen, setGestureOpen, setLeftPanel, setRightPanel, setAppGridOpen } = useApp();
  const [selected, setSelected] = useState<(typeof shortcuts)[number]['id']>('monitor');
  const active = shortcuts.find((shortcut) => shortcut.id === selected) ?? shortcuts[0];
  const ActiveIcon = active.icon;

  const runShortcut = () => {
    if (selected === 'monitor' || selected === 'memory') setLeftPanel(selected);
    if (selected === 'chat') setRightPanel('console');
    if (selected === 'apps') setAppGridOpen(true);
    setGestureOpen(false);
  };

  return (
    <AnimatePresence>
      {gestureOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[190] flex items-center justify-center overflow-y-auto p-4 sm:p-8" style={{ background: 'rgba(0,5,15,.92)', backdropFilter: 'blur(10px)' }} onMouseDown={(event) => { if (event.target === event.currentTarget) setGestureOpen(false); }}>
          <motion.section role="dialog" aria-modal="true" aria-labelledby="classic-gesture-title" initial={{ opacity: 0, scale: .94, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 12 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="w-full max-w-3xl overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#06111f]/95 shadow-[0_0_60px_rgba(0,245,255,.12)]">
            <header className="flex items-center justify-between gap-4 border-b border-cyan-300/10 px-5 py-4 sm:px-7">
              <div><h2 id="classic-gesture-title" style={{ ...orb, letterSpacing: '.14em' }} className="text-sm text-cyan-200">CONTROLES GESTUAIS</h2><p style={mono} className="text-2xs text-cyan-100/45">PRÉVIA VISUAL DE ATALHOS</p></div>
              <motion.button type="button" whileHover={{ scale: 1.08, rotate: 90 }} whileTap={{ scale: .9 }} aria-label="Fechar controles gestuais" onClick={() => setGestureOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-300/20 text-red-200"><X className="h-4 w-4" /></motion.button>
            </header>
            <div className="grid gap-5 p-5 sm:grid-cols-[.9fr_1.1fr] sm:p-7">
              <div className="relative flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-xl border border-cyan-200/10 bg-[#020914] p-5">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(0,245,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,.08) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <motion.div key={selected} initial={{ scale: .82, opacity: .5, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }} className="relative z-10 flex h-32 w-32 items-center justify-center rounded-full border" style={{ color: active.color, borderColor: `${active.color}55`, boxShadow: `0 0 44px ${active.color}20, inset 0 0 24px ${active.color}10` }}>
                  <ActiveIcon className="h-12 w-12" aria-hidden="true" />
                  <motion.span animate={{ scale: [1, 1.16, 1], opacity: [.35, .8, .35] }} transition={{ duration: 2.4, repeat: Infinity }} className="absolute inset-[-10px] rounded-full border" style={{ borderColor: `${active.color}45` }} />
                </motion.div>
                <AnimatePresence mode="wait"><motion.p key={active.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} style={{ ...mono, color: active.color }} className="relative z-10 mt-5 text-2xs uppercase">{active.label}</motion.p></AnimatePresence>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-200/[.04] p-3"><Activity className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" /><p className="text-xs leading-relaxed text-amber-100/65">Prévia interativa. Esta interface não acessa a câmera nem reconhece gestos; escolha um atalho para visualizar o efeito e executá-lo.</p></div>
                <div className="space-y-2" role="group" aria-label="Atalhos de interface">
                  {shortcuts.map((shortcut) => {
                    const Icon = shortcut.icon;
                    const isSelected = shortcut.id === selected;
                    return <motion.button key={shortcut.id} type="button" whileHover={{ x: 4 }} whileTap={{ scale: .98 }} aria-pressed={isSelected} onClick={() => setSelected(shortcut.id)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors" style={{ color: isSelected ? shortcut.color : 'rgba(255,255,255,.55)', borderColor: isSelected ? `${shortcut.color}45` : 'rgba(255,255,255,.06)', background: isSelected ? `${shortcut.color}0d` : 'rgba(255,255,255,.02)' }}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block text-xs">{shortcut.label}</span><span className="mt-0.5 block text-2xs text-white/35">{shortcut.detail}</span></span>{isSelected && <Zap className="h-3.5 w-3.5" aria-hidden="true" />}
                    </motion.button>;
                  })}
                </div>
                <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: .97 }} onClick={runShortcut} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 font-mono text-2xs uppercase tracking-wider" style={{ color: active.color, borderColor: `${active.color}50`, background: `${active.color}12` }}>Executar atalho <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></motion.button>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
