import { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

import { useApp } from '../ClassicContext';

const SettingsView = lazy(() => import('@/features/settings/SettingsView').then((module) => ({ default: module.SettingsView })));

export function SettingsPanel() {
  const { settingsOpen, setSettingsOpen } = useApp();

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 180, background: 'rgba(0,4,12,.94)', backdropFilter: 'blur(12px)' }}>
          <motion.div initial={{ opacity: 0, scale: .96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .98, y: 8 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }} className="relative h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl border border-primary/20 bg-background shadow-2xl">
            <motion.button type="button" whileHover={{ scale: 1.08, rotate: 90 }} whileTap={{ scale: .9 }} aria-label="Fechar configurações" onClick={() => setSettingsOpen(false)} className="sticky left-full top-3 z-10 mr-3 mt-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-background/90 text-primary">
              <X className="h-4 w-4" />
            </motion.button>
            <Suspense fallback={<p role="status" className="p-6 font-mono text-xs text-primary">Carregando configurações…</p>}>
              <SettingsView />
            </Suspense>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
