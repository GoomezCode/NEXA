import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const tones = {
  neutral: 'border-border bg-foreground/5 text-muted',
  primary: 'border-primary/25 bg-primary/5 text-primary',
  success: 'border-success/25 bg-success/5 text-success',
  warning: 'border-warning/25 bg-warning/5 text-warning',
  danger: 'border-danger/25 bg-danger/5 text-danger',
} as const;

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.12em]', tones[tone], className)}
      {...props}
    />
  );
}
