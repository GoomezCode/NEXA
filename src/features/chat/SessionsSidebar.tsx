import { MessageSquare, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { formatSessionTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui-store';

import { useCreateSession, useDeleteSession, useRenameSession, useSessions } from './api';

interface SessionsSidebarProps {
  onSelect?: () => void;
  className?: string;
}

export function SessionsSidebar({ onSelect, className }: SessionsSidebarProps) {
  const sessions = useSessions();
  const createSession = useCreateSession();
  const renameSession = useRenameSession();
  const deleteSession = useDeleteSession();
  const activeSessionId = useUiStore((state) => state.activeSessionId);
  const setActiveSessionId = useUiStore((state) => state.setActiveSessionId);
  const setActiveView = useUiStore((state) => state.setActiveView);

  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const allSessions = sessions.data ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSessions = normalizedQuery
    ? allSessions.filter((session) => session.title.toLowerCase().includes(normalizedQuery))
    : allSessions;

  const selectSession = (id: string) => {
    setActiveSessionId(id);
    setActiveView('chat');
    onSelect?.();
  };

  const handleCreate = () => {
    createSession.mutate(undefined, {
      onSuccess: (session) => selectSession(session.id),
    });
  };

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setDraftTitle(title);
    setConfirmingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftTitle('');
  };

  const submitRename = (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const title = draftTitle.trim();

    if (!title) {
      return;
    }

    renameSession.mutate({ sessionId: id, title }, { onSuccess: () => cancelRename() });
  };

  const confirmDelete = (id: string) => {
    deleteSession.mutate(id, {
      onSuccess: () => {
        if (activeSessionId === id) {
          const remaining = allSessions.filter((session) => session.id !== id);
          setActiveSessionId(remaining[0]?.id ?? null);
        }

        setConfirmingId(null);
      },
    });
  };

  const mutationError = renameSession.isError || deleteSession.isError;

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
        <div>
          <h2 className="font-display text-2xs tracking-[0.24em] text-primary">CONVERSAS</h2>
          <p className="font-mono text-2xs uppercase tracking-[0.16em] text-muted">
            {normalizedQuery
              ? `${filteredSessions.length} de ${allSessions.length}`
              : `${allSessions.length} registro${allSessions.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={createSession.isPending}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-2.5 py-2 text-2xs font-semibold uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Criar nova conversa"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Nova
        </button>
      </div>

      <div className="border-b border-white/5 px-3 py-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar conversas"
            aria-label="Buscar conversas"
            className="w-full rounded-lg border border-white/10 bg-background/50 py-2 pl-8 pr-8 text-xs text-foreground outline-none transition placeholder:text-muted/70 focus:border-primary/35"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:text-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <nav aria-label="Histórico de conversas" className="min-h-0 flex-1 overflow-y-auto p-2">
        {sessions.isLoading && (
          <p role="status" className="px-2 py-3 font-mono text-2xs text-muted">
            Carregando conversas…
          </p>
        )}

        {sessions.isError && (
          <div className="mx-1 mt-2 rounded-xl border border-danger/25 bg-danger/5 p-3">
            <p className="text-xs text-danger">Não foi possível carregar as conversas.</p>
            <button
              type="button"
              onClick={() => void sessions.refetch()}
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.12em] text-danger hover:underline"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Tentar novamente
            </button>
          </div>
        )}

        {sessions.isSuccess && allSessions.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted">Nenhuma conversa ainda. Crie a primeira.</p>
        )}

        {sessions.isSuccess && allSessions.length > 0 && filteredSessions.length === 0 && (
          <div className="px-2 py-3">
            <p className="text-xs text-muted">Nenhuma conversa encontrada.</p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-1 font-mono text-2xs uppercase tracking-[0.12em] text-primary hover:underline"
            >
              Limpar busca
            </button>
          </div>
        )}

        <ul className="space-y-1">
          {filteredSessions.map((session) => {
            const active = session.id === activeSessionId;

            if (confirmingId === session.id) {
              return (
                <li key={session.id}>
                  <div
                    role="alertdialog"
                    aria-label={`Excluir ${session.title}`}
                    className="rounded-xl border border-danger/30 bg-danger/5 p-2.5"
                  >
                    <p className="text-xs text-foreground">Excluir “{session.title}”?</p>
                    <p className="mt-0.5 font-mono text-2xs uppercase tracking-[0.1em] text-muted">
                      Esta ação não pode ser desfeita
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => confirmDelete(session.id)}
                        disabled={deleteSession.isPending}
                        className="rounded-lg border border-danger/35 bg-danger/15 px-2.5 py-1.5 font-mono text-2xs uppercase tracking-[0.12em] text-danger transition hover:bg-danger/25 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-2xs uppercase tracking-[0.12em] text-muted transition hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </li>
              );
            }

            if (editingId === session.id) {
              return (
                <li key={session.id}>
                  <form
                    onSubmit={(event) => submitRename(event, session.id)}
                    className="rounded-xl border border-primary/30 bg-primary/5 p-2.5"
                  >
                    <label htmlFor={`rename-${session.id}`} className="sr-only">
                      Novo título da conversa
                    </label>
                    <input
                      id={`rename-${session.id}`}
                      autoFocus
                      value={draftTitle}
                      maxLength={80}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          cancelRename();
                        }
                      }}
                      className="w-full rounded-lg border border-primary/30 bg-background/70 px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary/60"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="submit"
                        disabled={!draftTitle.trim() || renameSession.isPending}
                        className="rounded-lg border border-primary/35 bg-primary/15 px-2.5 py-1.5 font-mono text-2xs uppercase tracking-[0.12em] text-primary transition hover:bg-primary/25 disabled:opacity-50"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-2xs uppercase tracking-[0.12em] text-muted transition hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </li>
              );
            }

            return (
              <li key={session.id}>
                <div
                  className={cn(
                    'group relative rounded-xl border transition',
                    active
                      ? 'border-primary/30 bg-primary/10'
                      : 'border-transparent hover:border-white/10 hover:bg-white/5',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectSession(session.id)}
                    aria-current={active ? 'true' : undefined}
                    className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 pr-28 text-left"
                  >
                    <MessageSquare
                      className={cn(
                        'mt-0.5 h-3.5 w-3.5 shrink-0',
                        active ? 'text-primary' : 'text-muted',
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-[13px] leading-snug',
                          active ? 'text-foreground' : 'text-muted',
                        )}
                      >
                        {session.title}
                      </span>
                      <span className="font-mono text-2xs uppercase tracking-[0.12em] text-muted/70">
                        {formatSessionTime(session.updatedAt)}
                      </span>
                    </span>
                  </button>

                  <div className="absolute right-1 top-0 flex gap-0.5 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => startRename(session.id, session.title)}
                      aria-label={`Renomear ${session.title}`}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-muted transition hover:bg-white/10 hover:text-primary"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(session.id)}
                      aria-label={`Excluir ${session.title}`}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {mutationError && (
          <p role="alert" className="mx-1 mt-2 text-2xs text-danger">
            Não foi possível atualizar a conversa. Tente novamente.
          </p>
        )}
      </nav>

      <div className="border-t border-white/5 px-4 py-3">
        <p className="font-mono text-2xs uppercase leading-relaxed tracking-[0.14em] text-muted/70">
          Histórico local
          <br />
          modo demonstração
        </p>
      </div>
    </div>
  );
}
