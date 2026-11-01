import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { Brain, Database, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatSessionTime } from '@/lib/format';

import {
  useCreateMemory,
  useDeleteMemory,
  useMemories,
  useSetMemoryEnabled,
  useUpdateMemory,
  type MemoryEntry,
  type MemoryInput,
} from './api';
import { MemoryForm } from './MemoryForm';

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function MemoryView() {
  const memories = useMemories();
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();
  const setMemoryEnabled = useSetMemoryEnabled();
  const deleteMemory = useDeleteMemory();

  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MemoryEntry | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const entries = useMemo(() => memories.data ?? [], [memories.data]);
  const saving = createMemory.isPending || updateMemory.isPending;

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const entry of entries) {
      for (const tag of entry.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return counts;
  }, [entries]);

  const tags = useMemo(
    () => [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')),
    [tagCounts],
  );

  const effectiveTag = activeTag && tagCounts.has(activeTag) ? activeTag : null;

  const filtered = useMemo(() => {
    const needle = fold(query.trim());

    return entries.filter((entry) => {
      if (effectiveTag && !entry.tags.includes(effectiveTag)) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return fold([entry.title, entry.content, ...entry.tags].join(' ')).includes(needle);
    });
  }, [effectiveTag, entries, query]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setConfirmingId(null);
    setFormOpen(true);
  };

  const openEdit = (entry: MemoryEntry) => {
    setEditing(entry);
    setFormError(null);
    setConfirmingId(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const submit = (input: MemoryInput) => {
    setFormError(null);

    const onSuccess = () => closeForm();
    const onError = (error: unknown) =>
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a memória.');

    if (editing) {
      updateMemory.mutate({ id: editing.id, input }, { onSuccess, onError });
    } else {
      createMemory.mutate(input, { onSuccess, onError });
    }
  };

  const clearFilters = () => {
    setQuery('');
    setActiveTag(null);
  };

  return (
    <section aria-label="Memória" className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="rounded-2xl border border-border bg-surface/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-2xs uppercase tracking-[0.28em] text-primary/70">
                arquivo neural
              </p>
              <h2 className="font-display text-xl tracking-[0.12em] text-foreground">Memória</h2>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
                Fatos, preferências e contextos que a NEXA deve lembrar entre conversas.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-4 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Nova memória
            </button>
          </div>

          <p className="mt-3 flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-muted/60">
            <Database className="h-3 w-3" aria-hidden="true" />
            salvo apenas neste navegador · IndexedDB
          </p>
        </header>

        {formOpen && (
          <MemoryForm
            key={editing?.id ?? 'new-memory'}
            editing={editing}
            error={formError}
            saving={saving}
            onSubmit={submit}
            onCancel={closeForm}
          />
        )}

        <div className="rounded-2xl border border-border bg-surface/40 p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título, conteúdo ou tag"
              aria-label="Buscar memórias"
              className="w-full rounded-xl border border-white/10 bg-background/60 py-2 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-primary/35"
            />
          </div>

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                aria-pressed={effectiveTag === null}
                className={`inline-flex min-h-9 items-center rounded-full border px-3 text-2xs uppercase tracking-[0.1em] transition ${
                  effectiveTag === null
                    ? 'border-primary/35 bg-primary/10 text-primary'
                    : 'border-white/10 bg-white/5 text-muted hover:border-primary/25 hover:text-primary'
                }`}
              >
                Todas ({entries.length})
              </button>
              {tags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(effectiveTag === tag ? null : tag)}
                  aria-pressed={effectiveTag === tag}
                  className={`inline-flex min-h-9 items-center rounded-full border px-3 text-2xs uppercase tracking-[0.1em] transition ${
                    effectiveTag === tag
                      ? 'border-primary/35 bg-primary/10 text-primary'
                      : 'border-white/10 bg-white/5 text-muted hover:border-primary/25 hover:text-primary'
                  }`}
                >
                  {tag} ({count})
                </button>
              ))}
            </div>
          )}

          <p className="mt-3 font-mono text-2xs uppercase tracking-[0.1em] text-muted/60">
            {entries.length === 0
              ? 'nenhum registro'
              : `${filtered.length} de ${entries.length} memória${entries.length === 1 ? '' : 's'}`}
          </p>
          <p className="mt-1 font-mono text-2xs uppercase tracking-[0.1em] text-muted/60">
            {entries.filter((entry) => entry.enabled).length} memórias ativas para a IA
          </p>
        </div>

        {memories.isLoading && (
          <div role="status" aria-label="Carregando memórias" className="space-y-3 rounded-2xl border border-border bg-surface/40 p-6">
            {[0, 1, 2].map((row) => <Skeleton key={row} className="h-20" />)}
          </div>
        )}

        {memories.isError && (
          <div role="alert" className="rounded-2xl border border-danger/25 bg-danger/5 p-5">
            <p className="text-sm font-semibold text-danger">Memória indisponível</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Não foi possível carregar as memórias deste navegador.
            </p>
            <button
              type="button"
              onClick={() => void memories.refetch()}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-danger transition hover:bg-danger/15"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {deleteMemory.isError && (
          <p role="alert" className="text-2xs text-danger">
            Não foi possível esquecer a memória. Tente novamente.
          </p>
        )}

        {memories.isSuccess && entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-primary/20 bg-surface/30 p-8 text-center">
            <Brain className="mx-auto h-8 w-8 text-primary/60" aria-hidden="true" />
            <h3 className="mt-3 font-display text-lg tracking-[0.08em] text-foreground">
              Nenhuma memória ainda.
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">
              Guarde uma preferência, um fato ou um contexto para a NEXA usar depois.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-4 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Criar primeira memória
            </button>
          </div>
        )}

        {memories.isSuccess && entries.length > 0 && filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-surface/30 p-6 text-center">
            <p className="text-sm text-muted">Nenhuma memória encontrada.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 font-mono text-2xs uppercase tracking-[0.12em] text-primary hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="nexa-cards-grid">
            {filtered.map((entry) => (
              <article
                key={entry.id}
                aria-labelledby={`memory-title-${entry.id}`}
                className="flex flex-col rounded-2xl border border-white/8 bg-surface/50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3
                    id={`memory-title-${entry.id}`}
                    className="text-[13px] font-semibold leading-snug text-foreground"
                  >
                    {entry.title}
                  </h3>
                  <span className="shrink-0 font-mono text-2xs uppercase tracking-[0.08em] text-muted/60">
                    {formatSessionTime(entry.updatedAt)}
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted/90">
                  {entry.content}
                </p>

                {entry.tags.length > 0 && (
                  <ul aria-label={`Tags de ${entry.title}`} className="mt-3 flex flex-wrap gap-1.5">
                    {entry.tags.map((tag) => (
                      <li key={tag}>
                        <button
                          type="button"
                          onClick={() => setActiveTag(effectiveTag === tag ? null : tag)}
                          aria-pressed={effectiveTag === tag}
                          className={`inline-flex min-h-11 items-center rounded-full border px-3 text-2xs uppercase tracking-[0.08em] transition ${
                            effectiveTag === tag
                              ? 'border-primary/35 bg-primary/10 text-primary'
                              : 'border-white/10 bg-white/5 text-muted hover:border-primary/25 hover:text-primary'
                          }`}
                        >
                          {tag}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <label className="mt-3 flex min-h-9 cursor-pointer items-center gap-2 font-mono text-2xs uppercase tracking-[0.08em] text-muted">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    aria-label={`Usar memória ${entry.title} nesta IA`}
                    onChange={(event) => setMemoryEnabled.mutate({ id: entry.id, enabled: event.target.checked })}
                    className="accent-primary"
                  />
                  usar nesta IA
                </label>

                {confirmingId === entry.id ? (
                  <AlertDialog.Root open onOpenChange={(open) => { if (!open) setConfirmingId(null); }}>
                    <AlertDialog.Portal>
                      <AlertDialog.Overlay className="fixed inset-0 z-[89] bg-black/60 backdrop-blur-sm" />
                      <AlertDialog.Content aria-describedby="delete-memory-description" className="fixed left-1/2 top-1/2 z-[90] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-5 shadow-2xl">
                        <AlertDialog.Title className="font-display text-sm tracking-wide text-foreground">Esquecer “{entry.title}”?</AlertDialog.Title>
                        <AlertDialog.Description id="delete-memory-description" className="mt-2 text-sm text-muted">Esta ação não pode ser desfeita.</AlertDialog.Description>
                        <div className="mt-5 flex justify-end gap-2">
                          <AlertDialog.Cancel asChild><button type="button" className="min-h-11 rounded-xl border border-border px-3 text-sm text-muted">Cancelar</button></AlertDialog.Cancel>
                          <button type="button" onClick={() => deleteMemory.mutate(entry.id, { onSuccess: () => { setConfirmingId(null); setActiveTag(null); } })} disabled={deleteMemory.isPending} className="min-h-11 rounded-xl border border-danger/40 bg-danger/10 px-3 text-sm text-danger disabled:opacity-50">{deleteMemory.isPending ? 'Esquecendo…' : 'Esquecer'}</button>
                        </div>
                      </AlertDialog.Content>
                    </AlertDialog.Portal>
                  </AlertDialog.Root>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(entry)}
                      aria-label={`Editar ${entry.title}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-2xs uppercase tracking-[0.1em] text-muted transition hover:border-primary/25 hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(entry.id)}
                      aria-label={`Esquecer ${entry.title}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-2xs uppercase tracking-[0.1em] text-muted transition hover:border-danger/30 hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Esquecer
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
