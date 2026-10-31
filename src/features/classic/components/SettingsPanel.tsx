import { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

import { useAppUi } from '../ClassicContext';

const SettingsView = lazy(() => import('@/features/settings/SettingsView').then((module) => ({ default: module.SettingsView })));

export function SettingsPanel() {
  const { settingsOpen, setSettingsOpen } = useAppUi();

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="classic-settings-overlay fixed inset-0"
          style={{ zIndex: 180, background: 'rgba(0,4,12,.94)', backdropFilter: 'blur(12px)' }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="classic-settings-dialog-title"
            initial={{ opacity: 0, scale: .96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: .98, y: 8 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="classic-settings-dialog relative w-full max-w-5xl overflow-hidden rounded-2xl border border-primary/20 bg-background shadow-2xl"
          >
            <header className="classic-settings-header flex shrink-0 items-center justify-between border-b border-white/10 px-4">
              <h2 id="classic-settings-dialog-title" className="font-display text-xs tracking-[0.16em] text-primary">AJUSTES</h2>
              <motion.button
                type="button"
                whileHover={{ scale: 1.08, rotate: 90 }}
                whileTap={{ scale: .9 }}
                aria-label="Fechar configurações"
                onClick={() => setSettingsOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-background/90 text-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </motion.button>
            </header>
            <div className="classic-settings-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <Suspense fallback={<p role="status" className="p-6 font-mono text-xs text-primary">Carregando configurações…</p>}>
                <SettingsView />
              </Suspense>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
