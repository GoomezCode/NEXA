import type { CSSProperties } from 'react';

import type { AiState } from '@/api/types';
import { NexaMark } from '@/components/brand/NexaMark';
import { cn } from '@/lib/utils';

import { AI_STATE_LABEL } from './ai-state';

const ORB_COLOR: Record<AiState, string> = {
  idle: 'var(--nexa-orb-idle)',
  listening: 'var(--nexa-orb-listening)',
  processing: 'var(--nexa-orb-processing)',
  responding: 'var(--nexa-orb-responding)',
  error: 'var(--nexa-orb-error)',
};

const ORB_SIZE = {
  sm: 64,
  md: 96,
  lg: 144,
} as const;

interface OrbProps {
  state: AiState;
  size?: keyof typeof ORB_SIZE;
  className?: string;
}

export function Orb({ state, size = 'md', className }: OrbProps) {
  const color = ORB_COLOR[state];
  const pixels = ORB_SIZE[size];

  return (
    <div
      className={cn('nexa-orb relative flex items-center justify-center', className)}
      data-state={state}
      style={{ width: pixels, height: pixels, '--orb-color': color } as CSSProperties}
      role="img"
      aria-label={`NEXA: ${AI_STATE_LABEL[state].toLowerCase()}`}
    >
      <div
        className="nexa-spin-slow absolute inset-0 rounded-full border border-dashed"
        style={{ borderColor: 'color-mix(in oklab, var(--orb-color) 20%, transparent)' }}
        aria-hidden="true"
      />
      <div
        className="nexa-spin-reverse absolute inset-[10%] rounded-full border"
        style={{
          borderColor: 'color-mix(in oklab, var(--orb-color) 34%, transparent)',
          animationDuration: state === 'processing' ? '5s' : undefined,
        }}
        aria-hidden="true"
      />
      <div
        className="nexa-pulse absolute inset-[22%] rounded-full"
        style={{
          border: '1px solid color-mix(in oklab, var(--orb-color) 40%, transparent)',
          boxShadow: '0 0 24px color-mix(in oklab, var(--orb-color) 20%, transparent)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-[30%] rounded-full"
        style={{
          background: 'radial-gradient(circle at 38% 32%, color-mix(in oklab, var(--orb-color) 25%, transparent), var(--nexa-bg) 68%)',
          border: '1.5px solid var(--orb-color)',
          boxShadow: '0 0 28px color-mix(in oklab, var(--orb-color) 34%, transparent), inset 0 0 18px color-mix(in oklab, var(--orb-color) 14%, transparent)',
        }}
        aria-hidden="true"
      />
      <NexaMark size={Math.round(pixels * 0.3)} className="relative" />
    </div>
  );
}
