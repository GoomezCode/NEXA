import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { AppNotification, NotificationTone } from '@/stores/notification-store';
import { useNotificationStore } from '@/stores/notification-store';

const TONE: Record<
  NotificationTone,
  { icon: typeof Info; className: string; iconClassName: string }
> = {
  info: {
    icon: Info,
    className: 'border-primary/25 bg-surface/95',
    iconClassName: 'text-primary',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-success/25 bg-surface/95',
    iconClassName: 'text-success',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning/25 bg-surface/95',
    iconClassName: 'text-warning',
  },
  error: {
    icon: XCircle,
    className: 'border-danger/25 bg-surface/95',
    iconClassName: 'text-danger',
  },
};

function NotificationToast({ item }: { item: AppNotification }) {
  const remove = useNotificationStore((state) => state.remove);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const tone = TONE[item.tone];
  const Icon = tone.icon;

  useEffect(() => {
    if (paused) {
      return;
    }

    const timer = window.setTimeout(() => remove(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.duration, item.id, paused, remove]);

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={(event) => { if (event.pointerType === 'touch') touchStartX.current = event.clientX; }}
      onPointerUp={(event) => { const startX = touchStartX.current; if (startX !== null && startX - event.clientX > 56) remove(item.id); touchStartX.current = null; }}
      onPointerCancel={() => { touchStartX.current = null; }}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border p-3 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl',
        tone.className,
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone.iconClassName)} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold leading-snug text-foreground">{item.title}</p>
        {item.message && (
          <p className="mt-0.5 text-2xs leading-relaxed text-muted">{item.message}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => remove(item.id)}
        aria-label={`Dispensar notificação: ${item.title}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-white/10 hover:text-foreground active:scale-95"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function NotificationCenter() {
  const items = useNotificationStore((state) => state.items);

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="nexa-notification-center pointer-events-none fixed bottom-[calc(var(--safe-bottom)+6rem)] right-[max(0.75rem,var(--safe-right))] z-50 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2 sm:right-5 short:bottom-auto short:right-16 short:top-14"
    >
      {items.map((item) => (
        <NotificationToast key={item.id} item={item} />
      ))}
    </div>
  );
}
