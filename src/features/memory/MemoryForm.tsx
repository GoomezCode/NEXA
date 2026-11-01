import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { formatSessionTime } from '@/lib/format';

import { parseMemoryTags, type MemoryEntry, type MemoryInput } from './api';

const memoryFormSchema = z.object({
  title: z.string().trim().min(1, 'Informe um nome.').max(80, 'Use até 80 caracteres.'),
  content: z.string().trim().min(1, 'Informe o conteúdo.').max(4000, 'Use até 4.000 caracteres.'),
  tagsText: z.string(),
});

export function MemoryForm({
  editing,
  error,
  saving,
  onSubmit,
  onCancel,
}: {
  editing: MemoryEntry | null;
  error: string | null;
  saving: boolean;
  onSubmit: (input: MemoryInput) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(memoryFormSchema),
    mode: 'onBlur',
    defaultValues: {
      title: editing?.title ?? '',
      content: editing?.content ?? '',
      tagsText: editing?.tags.join(', ') ?? '',
    },
  });

  const submit = handleSubmit((values) => onSubmit({
    title: values.title,
    content: values.content,
    tags: parseMemoryTags(values.tagsText),
  }));

  return (
    <form aria-labelledby="memory-form-title" onSubmit={(event) => void submit(event)} className="rounded-2xl border border-primary/25 bg-surface/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 id="memory-form-title" className="font-display text-2xs tracking-[0.2em] text-primary">{editing ? 'EDITAR MEMÓRIA' : 'NOVA MEMÓRIA'}</h3>
        <button type="button" onClick={onCancel} aria-label="Fechar formulário" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted transition hover:border-border/80 hover:text-foreground"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="memory-title" className="block text-xs text-muted">Nome</label>
          <input id="memory-title" autoFocus maxLength={80} placeholder="Ex.: Preferências de resposta" aria-invalid={Boolean(errors.title)} {...register('title')} className="nexa-field mt-1 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-base text-foreground outline-none focus:border-primary/50 sm:text-sm" />
          {errors.title && <p role="alert" className="mt-1 text-xs text-danger">{errors.title.message}</p>}
        </div>
        <div>
          <label htmlFor="memory-tags" className="block text-xs text-muted">Tags</label>
          <input id="memory-tags" placeholder="sistema, preferências" {...register('tagsText')} className="nexa-field mt-1 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-base text-foreground outline-none focus:border-primary/50 sm:text-sm" />
          <p className="mt-1 font-mono text-2xs uppercase tracking-[0.08em] text-muted/60">separe por vírgulas · até 8 tags</p>
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor="memory-content" className="block text-xs text-muted">Conteúdo</label>
        <textarea id="memory-content" rows={4} maxLength={4000} placeholder="O que a NEXA deve lembrar?" aria-invalid={Boolean(errors.content)} {...register('content')} className="nexa-field mt-1 w-full resize-y rounded-xl border border-border bg-background/60 px-3 py-2 text-base leading-relaxed text-foreground outline-none focus:border-primary/50 sm:text-sm" />
        {errors.content && <p role="alert" className="mt-1 text-xs text-danger">{errors.content.message}</p>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-4 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />{saving ? 'Salvando…' : 'Salvar memória'}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted transition hover:text-foreground">Cancelar</button>
        {editing && <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted/60">atualizada em {formatSessionTime(editing.updatedAt)}</span>}
      </div>
    </form>
  );
}

