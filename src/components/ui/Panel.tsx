import { useId, useRef, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export function Panel({
  className,
  title,
  titleId,
  icon: Icon,
  children,
  onPointerMove,
  ...props
}: HTMLAttributes<HTMLElement> & { title?: string; titleId?: string; icon?: LucideIcon }) {
  const generatedTitleId = useId();
  const resolvedTitleId = title ? titleId ?? generatedTitleId : undefined;
  const frame = useRef<number | null>(null);
  const updateSpotlight = (event: PointerEvent<HTMLElement>) => {
    onPointerMove?.(event);
    if (!window.matchMedia('(pointer: fine)').matches || frame.current !== null) return;
    const panel = event.currentTarget;
    const rect = panel.getBoundingClientRect();
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      panel.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
      panel.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    });
  };
  return (
    <section aria-labelledby={props['aria-labelledby'] ?? resolvedTitleId} className={cn('nexa-spotlight rounded-2xl border border-border bg-surface/50', className)} onPointerMove={updateSpotlight} {...props}>
      {title && <h3 id={resolvedTitleId} className="flex items-center gap-2 font-display text-2xs tracking-[0.2em] text-primary">{Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}{title}</h3>}
      <div className={title ? 'mt-3 space-y-2.5' : undefined}>{children}</div>
    </section>
  );
}

export function SectionCard({
  id,
  title,
  icon: Icon,
  children,
  className,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel aria-labelledby={id} className={cn('p-4 sm:p-5', className)} title={title} titleId={id} icon={Icon}>
      {children}
    </Panel>
  );
}
