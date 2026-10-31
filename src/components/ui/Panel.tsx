import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export function Panel({
  className,
  title,
  titleId,
  icon: Icon,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { title?: string; titleId?: string; icon?: LucideIcon }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-surface/50', className)} {...props}>
      {title && <h3 id={titleId} className="flex items-center gap-2 font-display text-2xs tracking-[0.2em] text-primary">{Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}{title}</h3>}
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
