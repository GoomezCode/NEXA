import { Activity, Brain, MessageSquare, Settings } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useUiStore, type AppView } from '@/stores/ui-store';

const NAV_ITEMS: { id: AppView; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'memory', label: 'Memória', icon: Brain },
  { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

function NavButton({
  item,
  active,
  compact = false,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl border transition',
        compact ? 'h-12 flex-1 flex-col gap-0.5' : 'min-h-11 px-4 py-2',
        active
          ? 'border-primary/35 bg-primary/10 text-primary'
          : 'border-transparent text-muted hover:border-white/10 hover:bg-white/5 hover:text-foreground',
      )}
    >
      <Icon className={compact ? 'h-4 w-4' : 'h-4 w-4'} aria-hidden="true" />
      <span
        className={cn(
          'font-mono uppercase tracking-[0.1em]',
          compact ? 'text-[10px]' : 'text-[10px]',
        )}
      >
        {item.label}
      </span>
    </button>
  );
}

export function Dock() {
  const activeView = useUiStore((state) => state.activeView);
  const setActiveView = useUiStore((state) => state.setActiveView);

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="relative z-20 hidden h-16 shrink-0 items-center justify-center border-t border-white/5 bg-background/60 px-4 backdrop-blur-xl md:flex"
      >
        <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-surface/70 p-1.5">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeView === item.id}
              onClick={() => setActiveView(item.id)}
            />
          ))}
        </div>
      </nav>

      <nav
        aria-label="Navegação móvel"
        className="relative z-20 flex shrink-0 items-stretch gap-1 border-t border-white/5 bg-background/85 px-2 pt-1.5 backdrop-blur-xl md:hidden short:fixed short:inset-y-14 short:right-0 short:z-30 short:w-14 short:flex-col short:border-l short:border-t-0 short:px-1 short:pt-1"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeView === item.id}
            compact
            onClick={() => setActiveView(item.id)}
          />
        ))}
      </nav>
    </>
  );
}
