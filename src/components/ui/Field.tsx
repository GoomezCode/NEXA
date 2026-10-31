import type { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Field({
  id,
  label,
  error,
  trailing,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string; trailing?: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs text-muted">{label}</label>
      <div className="relative mt-1">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn('nexa-field w-full rounded-xl border bg-background/60 px-3 py-2 text-base text-foreground outline-none transition focus:border-primary/50 sm:text-sm', error ? 'border-danger/45' : 'border-border', trailing && 'pr-12', className)}
          {...props}
        />
        {trailing && <div className="absolute right-0 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
