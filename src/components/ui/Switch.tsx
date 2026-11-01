import { cn } from '@/lib/utils';

export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/40 p-3 text-left transition hover:border-border disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>}
      </span>
      <span aria-hidden="true" className={cn('flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition', checked ? 'border-primary/40 bg-primary/20' : 'border-border bg-foreground/5')}>
        <span className={cn('h-3.5 w-3.5 rounded-full transition', checked ? 'translate-x-4 bg-primary' : 'translate-x-0 bg-muted/60')} />
      </span>
    </button>
  );
}
