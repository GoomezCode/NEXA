import { motion, AnimatePresence } from 'motion/react';
import { Activity, Brain, Hand, MessageSquare, Settings, X } from 'lucide-react';

import { useAppUi } from '../ClassicContext';

const orb = { fontFamily: 'Orbitron, sans-serif' };
const mono = { fontFamily: 'Share Tech Mono, monospace' };
const APPS = [
  { name: 'Conversa', panel: 'console' as const, icon: MessageSquare, color: '#00f5ff' },
  { name: 'Memórias', panel: 'memory' as const, icon: Brain, color: '#a855f7' },
  { name: 'Monitor', panel: 'monitor' as const, icon: Activity, color: '#22c55e' },
  { name: 'Ajustes', panel: 'settings' as const, icon: Settings, color: '#0ea5e9' },
  { name: 'Gestos (prévia)', panel: 'gestures' as const, icon: Hand, color: '#f59e0b' },
];

export function AppGrid() {
  const { appGridOpen, setAppGridOpen, setSettingsOpen, setLeftPanel, setRightPanel, setGestureOpen } = useAppUi();
  return (
    <AnimatePresence>
      {appGridOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex flex-col" style={{ zIndex: 150, background: 'rgba(0,4,12,.96)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center justify-between border-b border-primary/15 px-8 py-5">
          <div><h2 style={{ ...orb, color: '#00f5ff', fontSize: '18px', letterSpacing: '.2em' }}>NEXA CLASSIC</h2><p style={{ ...mono, color: 'rgba(0,245,255,.45)', fontSize: '0.6875rem' }}>ATALHOS DISPONÍVEIS</p></div>
          <motion.button type="button" whileHover={{ scale: 1.08, rotate: 90 }} whileTap={{ scale: .9 }} aria-label="Fechar menu" onClick={() => setAppGridOpen(false)} className="rounded-xl border border-red-400/30 p-2 text-red-300"><X className="h-5 w-5" /></motion.button>
        </div>
        <div className="grid flex-1 content-center grid-cols-2 gap-4 p-8 md:grid-cols-4">
          {APPS.map(({ name, panel, icon: Icon, color }, index) => <motion.button key={name} initial={{ opacity: 0, y: 18, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: index * .05, type: 'spring', stiffness: 260, damping: 22 }} whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: .96 }} onClick={() => { if (panel === 'settings') setSettingsOpen(true); else if (panel === 'console') setRightPanel('console'); else if (panel === 'gestures') setGestureOpen(true); else setLeftPanel(panel); setAppGridOpen(false); }} className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" style={{ borderColor: `${color}40`, background: `${color}0c` }}><Icon className="h-8 w-8" style={{ color }} /><span style={{ ...mono, color, fontSize: '0.6875rem' }}>{name.toUpperCase()}</span></motion.button>)}
        </div>
      </motion.div>}
    </AnimatePresence>
  );
}
