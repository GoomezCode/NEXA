import type { AiState } from '@/api/types';
import { NexaMark } from '@/components/brand/NexaMark';
import { cn } from '@/lib/utils';

import { AI_STATE_LABEL } from './ai-state';

const ORB_COLOR: Record<AiState, string> = {
  idle: '#00e5ff',
  listening: '#34d399',
  processing: '#fbbf24',
  responding: '#a78bfa',
  error: '#fb7185',
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
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: pixels, height: pixels }}
      role="img"
      aria-label={`NEXA: ${AI_STATE_LABEL[state].toLowerCase()}`}
    >
      <div
        className="nexa-spin-slow absolute inset-0 rounded-full border border-dashed"
        style={{ borderColor: `${color}33` }}
        aria-hidden="true"
      />
      <div
        className="nexa-spin-reverse absolute inset-[10%] rounded-full border"
        style={{
          borderColor: `${color}55`,
          animationDuration: state === 'processing' ? '5s' : undefined,
        }}
        aria-hidden="true"
      />
      <div
        className="nexa-pulse absolute inset-[22%] rounded-full"
        style={{
          border: `1px solid ${color}66`,
          boxShadow: `0 0 24px ${color}33`,
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-[30%] rounded-full"
        style={{
          background: `radial-gradient(circle at 38% 32%, ${color}40, rgba(4, 7, 15, 0.92) 68%)`,
          border: `1.5px solid ${color}`,
          boxShadow: `0 0 28px ${color}55, inset 0 0 18px ${color}22`,
        }}
        aria-hidden="true"
      />
      <NexaMark size={Math.round(pixels * 0.3)} className="relative" />
    </div>
  );
}
