import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useApiHealth } from '@/api/health';
import { useOllamaHealth } from '@/api/ollama';
import { useConnectionStore } from '@/stores/connection-store';
import { useElementSize } from '@/hooks/use-element-size';
import { usePointerType } from '@/hooks/use-pointer-type';
import { useApp } from '../ClassicContext';

const orb = { fontFamily: 'Orbitron, sans-serif' };
const mono = { fontFamily: 'Share Tech Mono, monospace' };
const raj = { fontFamily: 'Rajdhani, sans-serif' };

const stateConfig = {
  idle: {
    color: '#00f5ff',
    glow: 'rgba(0, 245, 255, 0.5)',
    label: 'STANDBY',
    subLabel: 'NEXA NEURAL CORE ONLINE',
    pulseSpeed: 3,
    ringColor: 'rgba(0,245,255,0.4)',
  },
  listening: {
    color: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.6)',
    label: 'LISTENING',
    subLabel: 'VOICE RECOGNITION ACTIVE',
    pulseSpeed: 0.8,
    ringColor: 'rgba(34,197,94,0.5)',
  },
  processing: {
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.6)',
    label: 'PROCESSING',
    subLabel: 'NEURAL ANALYSIS IN PROGRESS',
    pulseSpeed: 0.4,
    ringColor: 'rgba(245,158,11,0.5)',
  },
  responding: {
    color: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.6)',
    label: 'RESPONDING',
    subLabel: 'GENERATING OUTPUT STREAM',
    pulseSpeed: 0.6,
    ringColor: 'rgba(168,85,247,0.5)',
  },
  error: {
    color: '#ef4444',
    glow: 'rgba(239,68,68,0.6)',
    label: 'ERROR',
    subLabel: 'VERIFIQUE A RESPOSTA DO SERVIÇO',
    pulseSpeed: 0.8,
    ringColor: 'rgba(239,68,68,0.5)',
  },
};

function Ring({
  size,
  thickness,
  color,
  duration,
  direction = 1,
  dashed = false,
  tilt = 0,
  motionEnabled = true,
}: {
  size: number;
  thickness: number;
  color: string;
  duration: number;
  direction?: number;
  dashed?: boolean;
  tilt?: number;
  motionEnabled?: boolean;
}) {
  return (
    <motion.div
      animate={motionEnabled ? { rotate: direction * 360 } : { rotate: 0 }}
      transition={{ duration, repeat: motionEnabled ? Infinity : 0, ease: 'linear' }}
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: '50%',
        top: '50%',
        marginLeft: -size / 2,
        marginTop: -size / 2,
        border: `${thickness}px ${dashed ? 'dashed' : 'solid'} ${color}`,
        boxShadow: `0 0 8px ${color.replace('0.', '0.3')}`,
        transform: `rotateX(${tilt}deg)`,
        transformStyle: 'preserve-3d',
      }}
    />
  );
}

export function AICore() {
  const { aiState, memories, voiceSupported, voiceListening, startVoice, stopVoice, isStreaming, setConversationOpen } = useApp();
  const health = useApiHealth();
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const ollama = useOllamaHealth();
  const cfg = stateConfig[aiState];
  const orbSize = useElementSize<HTMLDivElement>();
  const coreSize = orbSize.width || 380;
  const ringSize = (referenceSize: number) => Math.round(coreSize * referenceSize / 380);
  const reducedMotion = useReducedMotion() ?? false;
  const pointerType = usePointerType();
  const coreRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const motionEnabled = !reducedMotion && visible && pointerType !== 'coarse';

  useEffect(() => {
    const element = coreRef.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const toggleVoice = () => {
    if (voiceListening) stopVoice();
    else if (voiceSupported && !isStreaming) startVoice();
    else if (!voiceSupported) setConversationOpen(true);
  };

  return (
    <div
      ref={coreRef}
      className="classic-ai-core flex flex-col items-center justify-center gap-6 select-none"
      style={{ perspective: '600px' }}
    >
      {/* Outer data ring indicators */}
      <div ref={orbSize.ref} className="classic-ai-core-orb relative max-w-full" style={{ width: 'min(380px, 80vw, 50dvh)', aspectRatio: '1' }}>
        {/* Data point markers */}
        {/* Outer dashed ring */}
        <Ring size={ringSize(340)} thickness={1} color="rgba(0,245,255,0.1)" duration={40} dashed motionEnabled={motionEnabled} />

        {/* Ring 1 — large slow */}
        <Ring
          size={ringSize(300)}
          thickness={1}
          color={cfg.ringColor.replace('0.5', '0.2')}
          duration={20}
          direction={1}
          tilt={20}
          motionEnabled={motionEnabled}
        />
        {/* Ring 2 — medium counter */}
        <Ring
          size={ringSize(260)}
          thickness={1.5}
          color={cfg.ringColor.replace('0.5', '0.3')}
          duration={14}
          direction={-1}
          tilt={-15}
          motionEnabled={motionEnabled}
        />
        {/* Ring 3 — fast accent */}
        <Ring size={ringSize(210)} thickness={1} color={cfg.ringColor} duration={8} direction={1} motionEnabled={motionEnabled} />

        {/* Pulse wave rings */}
        <motion.div
          animate={motionEnabled ? { scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] } : { scale: 1, opacity: 0.15 }}
          transition={{ duration: cfg.pulseSpeed * 2, repeat: motionEnabled ? Infinity : 0 }}
          className="absolute rounded-full"
          style={{
            width: ringSize(180),
            height: ringSize(180),
            left: '50%',
            top: '50%',
            marginLeft: -ringSize(90),
            marginTop: -ringSize(90),
            border: `1px solid ${cfg.color}`,
          }}
        />
        <motion.div
          animate={motionEnabled ? { scale: [1, 1.6, 1], opacity: [0.2, 0, 0.2] } : { scale: 1, opacity: 0.1 }}
          transition={{ duration: cfg.pulseSpeed * 2, repeat: motionEnabled ? Infinity : 0, delay: 0.4 }}
          className="absolute rounded-full"
          style={{
            width: ringSize(180),
            height: ringSize(180),
            left: '50%',
            top: '50%',
            marginLeft: -ringSize(90),
            marginTop: -ringSize(90),
            border: `1px solid ${cfg.color}`,
          }}
        />

        {/* Clickable Core Orb */}
        <motion.button
          type="button"
          onClick={toggleVoice}
          whileHover={voiceSupported && !isStreaming ? { scale: 1.05 } : undefined}
          whileTap={!isStreaming ? { scale: 0.95 } : undefined}
          disabled={isStreaming}
          aria-label={voiceListening ? 'Parar microfone da NEXA' : voiceSupported ? 'Ativar microfone da NEXA' : 'Abrir console da NEXA'}
          aria-pressed={voiceListening}
          title={voiceListening ? 'Toque para parar o microfone' : voiceSupported ? 'Toque para falar com a NEXA' : 'Toque para abrir o console'}
          className="absolute flex cursor-pointer items-center justify-center rounded-full p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed"
          style={{
            width: ringSize(160),
            height: ringSize(160),
            left: '50%',
            top: '50%',
            marginLeft: -ringSize(80),
            marginTop: -ringSize(80),
            background: `radial-gradient(circle at 35% 35%, ${cfg.color}25 0%, rgba(0,5,20,0.9) 60%, rgba(0,2,10,1) 100%)`,
            border: `2px solid ${cfg.color}`,
            boxShadow: `0 0 30px ${cfg.glow}, 0 0 60px ${cfg.glow.replace('0.5', '0.2')}, inset 0 0 30px ${cfg.glow.replace('0.5', '0.15')}`,
            transition: 'box-shadow 0.5s, border-color 0.5s, background 0.5s',
          }}
        >
          {/* Inner glow core */}
          <motion.div
            animate={motionEnabled ? { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] } : { scale: 1, opacity: 0.9 }}
            transition={{ duration: cfg.pulseSpeed, repeat: motionEnabled ? Infinity : 0 }}
            className="rounded-full flex items-center justify-center flex-col gap-1"
            style={{
              width: ringSize(120),
              height: ringSize(120),
              background: `radial-gradient(circle, ${cfg.color}20 0%, transparent 70%)`,
            }}
          >
            {/* Core logo */}
            <motion.div
              animate={motionEnabled && aiState === 'processing' ? { rotate: 360 } : { rotate: 0 }}
              transition={{
                duration: 1.5,
                repeat: motionEnabled && aiState === 'processing' ? Infinity : 0,
                ease: 'linear',
              }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="16" stroke={cfg.color} strokeWidth="1" opacity="0.5" />
                <circle cx="18" cy="18" r="10" stroke={cfg.color} strokeWidth="1.5" opacity="0.8" />
                <circle cx="18" cy="18" r="4" fill={cfg.color} />
                <line x1="18" y1="2" x2="18" y2="8" stroke={cfg.color} strokeWidth="1.5" />
                <line x1="18" y1="28" x2="18" y2="34" stroke={cfg.color} strokeWidth="1.5" />
                <line x1="2" y1="18" x2="8" y2="18" stroke={cfg.color} strokeWidth="1.5" />
                <line x1="28" y1="18" x2="34" y2="18" stroke={cfg.color} strokeWidth="1.5" />
              </svg>
            </motion.div>
            <span
              style={{
                ...orb,
                color: cfg.color,
                fontSize: '0.6875rem',
                letterSpacing: '0.1em',
                textAlign: 'center',
                opacity: 0.9,
              }}
            >
              NEXA
            </span>
          </motion.div>
        </motion.button>
      </div>

      {/* State label */}
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={aiState}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-1"
          >
            <span
              style={{
                ...orb,
                color: cfg.color,
                fontSize: '16px',
                letterSpacing: '0.25em',
                textShadow: `0 0 15px ${cfg.glow}`,
              }}
            >
              {cfg.label}
            </span>
            <span
              style={{
                ...mono,
                color: 'rgba(255,255,255,0.35)',
                fontSize: '0.6875rem',
                letterSpacing: '0.12em',
              }}
            >
              {cfg.subLabel}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Status bar */}
        <div className="flex items-center gap-3 mt-1">
          {[
            { name: 'CHAT', active: aiState === 'responding' || aiState === 'processing' },
            { name: 'VOICE', active: voiceListening },
            { name: 'MEMÓRIA', active: memories.length > 0 },
            { name: offlineMode ? 'OLLAMA' : 'API', active: offlineMode ? !ollama.isError && !!ollama.data : health.data?.status === 'ok' },
          ].map(({ name, active }) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <div
                className="w-12 h-0.5 rounded-full overflow-hidden"
                style={{ background: active ? cfg.color : 'rgba(255,255,255,0.06)' }}
              >
              </div>
              <span style={{ ...mono, color: 'rgba(255,255,255,0.25)', fontSize: '0.6875rem' }}>
                {name}
              </span>
            </div>
          ))}
        </div>

        <motion.p
          animate={motionEnabled ? { opacity: [0.3, 0.6, 0.3] } : { opacity: 0.5 }}
          transition={{ duration: 3, repeat: motionEnabled ? Infinity : 0 }}
          style={{ ...raj, color: 'rgba(0,245,255,0.4)', fontSize: '0.6875rem', marginTop: 4 }}
        >
          {offlineMode ? ollama.isError ? 'OLLAMA LOCAL INDISPONÍVEL' : ollama.data ? `OLLAMA ${ollama.data} CONECTADO` : 'VERIFICANDO OLLAMA' : health.data?.status === 'ok' ? 'API CONNECTADA' : 'STATUS DA API INDISPONÍVEL'}
        </motion.p>
        <motion.p
          animate={motionEnabled ? { opacity: [0.35, 0.65, 0.35] } : { opacity: 0.5 }}
          transition={{ duration: 2.4, repeat: motionEnabled ? Infinity : 0 }}
          style={{ ...mono, color: 'rgba(0,245,255,0.32)', fontSize: '0.6875rem', letterSpacing: '0.08em' }}
        >
          {voiceListening ? 'TOQUE PARA ENCERRAR A ESCUTA' : voiceSupported ? 'TOQUE NO NÚCLEO PARA FALAR' : 'MICROFONE INDISPONÍVEL'}
        </motion.p>
      </div>
    </div>
  );
}
