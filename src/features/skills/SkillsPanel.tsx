import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useMemo, useRef, useState } from 'react';
import { FileUp, Plus, Search, Trash2 } from 'lucide-react';

import { TagInput } from '@/components/ui/TagInput';
import { appEnv } from '@/lib/env';
import { fold } from '@/lib/text-search';
import { useAuthStore } from '@/stores/auth-store';
import { isOfflineMode } from '@/stores/connection-store';
import { useCreateSkill, useDeleteSkill, useSetSkillEnabled, useSkills, useUpdateSkill, type SkillEntry, type SkillInput } from './api';
import { skillLimitFor } from './limits';
import { suggestSkillTags } from './tags';
import { readSkillFile } from './import/read-skill-file';
import type { ParseSkillResult, ParsedSkillFile } from './import/parse-skill-md';
import { SkillDropOverlay } from './import/SkillDropOverlay';
import { useSkillFileDrop } from './import/use-skill-file-drop';

const EMPTY_SKILLS: SkillEntry[] = [];
const templates: SkillInput[] = [
  { name: 'Revisor de código', description: 'Ao receber trechos de código', instructions: 'Revise o código em três partes: bugs, legibilidade e desempenho. Seja direto e dê exemplos corrigidos.', tags: ['código', 'revisor'] },
  { name: 'Resumo executivo', description: 'Resumir textos longos', instructions: 'Resuma o conteúdo em tópicos claros. Comece pelas conclusões e preserve dados importantes.', tags: ['resumo', 'executivo'] },
  { name: 'Explicar simples', description: 'Quando eu pedir uma explicação', instructions: 'Explique com linguagem simples, exemplos concretos e uma ideia por vez.', tags: ['explicação'] },
];

interface ImportItem {
  id: string;
  fileName: string;
  result: ParseSkillResult;
  selected: boolean;
  duplicate: boolean;
  state: 'ready' | 'error' | 'imported' | 'skipped' | 'failed';
  reason?: string;
}

export function SkillsPanel() {
  const query = useSkills();
  const create = useCreateSkill();
  const update = useUpdateSkill();
  const toggle = useSetSkillEnabled();
  const remove = useDeleteSkill();
  const fileInput = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<SkillEntry | null>(null);
  const [form, setForm] = useState<SkillInput | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<SkillEntry | null>(null);
  const [tagsTouched, setTagsTouched] = useState(false);
  const [importError, setImportError] = useState('');
  const [importNotice, setImportNotice] = useState<{ fileName: string; warnings: string[]; duplicate: boolean } | null>(null);
  const [batch, setBatch] = useState<ImportItem[] | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);

  const items = query.data ?? EMPTY_SKILLS;
  const role = useAuthStore((state) => state.session?.role ?? null);
  const offline = isOfflineMode();
  const limit = skillLimitFor({ offline, role });
  const canCreate = limit === null || items.length < limit;
  const { dropRef, isDragging } = useSkillFileDrop((files) => void handleFiles(files));

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts].sort((a, b) => a[0] === 'skill' ? 1 : b[0] === 'skill' ? -1 : b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  }, [items]);

  const filtered = useMemo(() => items.filter((item) => {
    if (status === 'enabled' && !item.enabled || status === 'disabled' && item.enabled) return false;
    if (activeTag && !item.tags.includes(activeTag)) return false;
    const queryText = q.trim();
    if (!queryText) return true;
    if (queryText.startsWith('#')) return item.tags.some((tag) => fold(tag).includes(fold(queryText.slice(1))));
    return fold([item.name, item.description, item.instructions, ...item.tags].join(' ')).includes(fold(queryText));
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.updatedAt.localeCompare(a.updatedAt)), [items, q, status, sort, activeTag]);

  function start(item?: SkillEntry | SkillInput) {
    const existing = item && 'id' in item ? item : null;
    setTagsTouched(false);
    setImportNotice(null);
    setEditing(existing);
    setForm(item ? { name: item.name, description: item.description, instructions: item.instructions, tags: item.tags.filter((tag) => tag !== 'skill') } : { name: '', description: '', instructions: '', tags: [] });
  }

  async function handleFiles(files: File[]) {
    setImportError('');
    setImportNotice(null);
    setBatch(null);
    if (!files.length) return;
    const tooMany = files.length > 20;
    const selectedFiles = files.slice(0, 20);
    if (selectedFiles.length === 1) {
      const result = await readSkillFile(selectedFiles[0]!);
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      if (!canCreate) {
        setImportError(quotaMessage(items.length, limit, role));
        return;
      }
      const duplicate = items.some((item) => fold(item.name) === fold(result.value.name));
      openImported(result.value, duplicate, tooMany ? ['Foram processados apenas os primeiros 20 arquivos.'] : []);
      return;
    }
    const parsed = await Promise.all(selectedFiles.map((file) => readSkillFile(file)));
    const seen = new Set(items.map((item) => fold(item.name)));
    const entries = parsed.map((result, index): ImportItem => {
      const fileName = selectedFiles[index]!.name;
      if (!result.ok) return { id: `${fileName}-${index}`, fileName, result, selected: false, duplicate: false, state: 'error' };
      const normalizedName = fold(result.value.name);
      const duplicate = seen.has(normalizedName);
      seen.add(normalizedName);
      return { id: `${fileName}-${index}`, fileName, result, selected: true, duplicate, state: 'ready' };
    });
    if (tooMany) entries.push({ id: 'batch-limit', fileName: 'Arquivos excedentes', result: { ok: false, error: 'Máximo de 20 arquivos por importação.' }, selected: false, duplicate: false, state: 'error' });
    setBatch(entries);
  }

  function openImported(value: ParsedSkillFile, duplicate: boolean, extraWarnings: string[] = []) {
    setEditing(null);
    setForm({ name: value.name, description: value.description, instructions: value.instructions, tags: value.tags });
    setTagsTouched(value.tags.length > 0);
    setError('');
    setImportNotice({ fileName: value.fileName, warnings: [...value.warnings, ...extraWarnings], duplicate });
  }

  async function importBatch() {
    if (!batch) return;
    setBatchBusy(true);
    let slots = limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - items.length);
    const result = [...batch];
    for (let index = 0; index < result.length; index += 1) {
      const item = result[index]!;
      if (!item.selected || !item.result.ok) continue;
      if (slots <= 0) {
        result[index] = { ...item, state: 'skipped', reason: quotaMessage(limit ?? items.length, limit, role) };
        continue;
      }
      const skill = item.result.value;
      try {
        await create.mutateAsync({ name: skill.name, description: skill.description, instructions: skill.instructions, tags: skill.tags.length ? skill.tags : suggestSkillTags(skill.name, skill.description, skill.instructions, items.flatMap((entry) => entry.tags)) });
        slots -= 1;
        result[index] = { ...item, state: 'imported' };
      } catch (cause) {
        result[index] = { ...item, state: 'failed', reason: cause instanceof Error ? cause.message : 'Não foi possível importar.' };
      }
    }
    setBatch(result);
    setBatchBusy(false);
  }

  async function save() {
    if (!form) return;
    setError('');
    const input = { ...form, tags: tagsTouched || (editing && form.tags.length > 0) ? form.tags : suggestSkillTags(form.name, form.description, form.instructions, items.flatMap((item) => item.tags)) };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input });
      else await create.mutateAsync(input);
      setForm(null);
      setEditing(null);
      setImportNotice(null);
      setTagsTouched(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.');
    }
  }

  function onFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    void handleFiles(files);
  }

  return (
    <div ref={dropRef} data-testid="skills-drop-area" className="relative space-y-4">
      {isDragging && <SkillDropOverlay />}
      <section className="rounded-2xl border border-border bg-surface/40 p-4 text-sm text-muted">
        Skills ensinam a IA <b>como agir</b>; memórias guardam fatos. Salvas apenas neste navegador · {offline ? 'Offline' : role === 'admin' ? 'Admin' : role === 'user' ? 'Conta' : 'Convidado'}.
        <p className="mt-2 font-mono text-xs">{limit === null ? `${items.length} skills · ilimitado` : `${items.length} de ${limit} skills`}</p>
        {limit !== null && items.length <= limit && <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Skills cadastradas" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={items.length}><div className="h-full bg-primary" style={{ width: `${Math.min(100, items.length / limit * 100)}%` }} /></div>}
        {limit !== null && items.length > limit && <p role="status" className="mt-1 text-xs">Você tem mais skills do que o limite atual ({limit}). Elas continuam salvas, mas só as {limit} mais recentes ativas são usadas.</p>}
        {limit !== null && items.length === limit && <p id="skill-quota-message" role="status" className="mt-1 text-xs">{quotaMessage(items.length, limit, role)}</p>}
        {!offline && !appEnv.skillsApiEnabled && <p className="mt-2 text-xs">Skills ainda não são enviadas à IA nesta versão da API.</p>}
      </section>

      <section className="rounded-2xl border border-border bg-surface/40 p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden="true" /><input type="search" aria-label="Buscar skills" className="min-h-11 w-full rounded-xl border border-white/10 bg-background/60 pl-9 pr-3 text-sm" placeholder="Buscar ou #tag" value={q} onChange={(event) => setQ(event.target.value)} /></div>
          <select aria-label="Filtrar status" className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todas</option><option value="enabled">Ativas</option><option value="disabled">Desativadas</option></select>
          <select aria-label="Ordenar skills" className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recentes</option><option value="name">Nome (A–Z)</option><option value="oldest">Mais antigas</option></select>
          <button type="button" aria-disabled={!canCreate} aria-describedby={!canCreate ? 'skill-quota-message' : undefined} onClick={() => { if (canCreate) start(); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/35 px-4 text-sm text-primary"><Plus className="h-4 w-4" />Nova skill</button>
          <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-foreground"><FileUp className="h-4 w-4" aria-hidden="true" />Importar arquivo .md</button>
          <input ref={fileInput} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" aria-label="Selecionar arquivos de skills" multiple hidden onChange={onFileInput} />
        </div>
        <p className="mt-2 hidden text-xs text-muted sm:block">Arraste um arquivo .md aqui ou use Importar arquivo</p>
        <p className="mt-2 text-xs text-muted sm:hidden">Importe uma skill de um arquivo .md</p>
        <div aria-live="polite" className="mt-2 space-y-1">
          {importError && <p role="alert" className="text-sm text-danger">{importError}</p>}
        </div>
        {batch && <section aria-label="Resumo da importação" className="mt-3 space-y-3 rounded-xl border border-border bg-background/40 p-3">
          <h3 className="text-sm font-semibold">Resumo da importação</h3>
          <ul className="space-y-2">{batch.map((item) => <li key={item.id} className="flex items-start gap-2 text-xs">
            <input type="checkbox" aria-label={`Selecionar ${item.fileName}`} checked={item.selected} disabled={!item.result.ok || batchBusy || item.state === 'imported'} onChange={(event) => setBatch((current) => current?.map((entry) => entry.id === item.id ? { ...entry, selected: event.target.checked } : entry) ?? null)} />
            <div><strong>{item.fileName}</strong> · {item.state === 'imported' ? '✔ importada' : item.state === 'skipped' ? '⚠ não importada' : item.state === 'failed' || item.state === 'error' ? '✖ erro' : item.result.ok ? item.result.value.warnings.length || item.duplicate ? '⚠ pronta com avisos' : '✔ pronta' : '✖ erro'}
              {!item.result.ok && <p role="alert">{item.result.error}</p>}{item.reason && <p role="status">{item.reason}</p>}{item.duplicate && item.result.ok && <p className="text-amber-300">Já existe skill com esse nome; desmarque para ignorar.</p>}{item.result.ok && item.result.value.warnings.map((warning) => <p key={warning} className="text-amber-300">{warning}</p>)}
            </div>
          </li>)}</ul>
          <button type="button" disabled={batchBusy || !batch.some((item) => item.selected && item.result.ok && item.state === 'ready')} onClick={() => void importBatch()} className="min-h-11 rounded-xl bg-primary/10 px-4 text-sm text-primary">{batchBusy ? 'Importando…' : `Importar ${batch.filter((item) => item.selected && item.result.ok && item.state === 'ready').length} skills`}</button>
        </section>}
        {tagCounts.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5"><button type="button" aria-pressed={!activeTag} onClick={() => setActiveTag(null)} className="min-h-9 rounded-full border border-white/10 px-3 text-xs">Todas ({items.length})</button>{tagCounts.map(([tag, count]) => <button key={tag} type="button" aria-pressed={activeTag === tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)} className={`min-h-9 rounded-full border px-3 text-xs ${activeTag === tag ? 'border-primary/35 bg-primary/10 text-primary' : 'border-white/10 text-muted'}`}>#{tag} ({count})</button>)}</div>}
        {limit !== null && !canCreate && <span id="skill-quota-description" className="sr-only">Limite de skills atingido</span>}
        <p className="mt-3 text-xs text-muted">{filtered.length} de {items.length} skills · {items.filter((item) => item.enabled).length} ativas para a IA</p>
      </section>

      {form && <section className="space-y-3 rounded-2xl border border-primary/25 bg-surface/50 p-4"><h3 className="font-semibold">{editing ? 'Editar skill' : 'Nova skill'}</h3>
        {importNotice && <div className="rounded-lg border border-white/10 p-3 text-xs"><p>Importada de <strong>{importNotice.fileName}</strong></p>{importNotice.duplicate && <p role="status" className="mt-1 text-amber-300">Já existe uma skill com este nome. Você pode renomear antes de salvar.</p>}{importNotice.warnings.map((warning) => <p key={warning} className="mt-1 font-semibold text-amber-300">{warning}</p>)}</div>}
        <p className="text-xs text-muted">1 · Identificação</p><label className="block text-sm">Nome<input autoFocus maxLength={60} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-background px-3 text-base" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><span className="text-xs text-muted">{form.name.length}/60</span></label>
        <label className="block text-sm">Quando usar<input maxLength={200} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-background px-3 text-base" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><p className="text-xs text-muted">2 · Instruções para a IA</p>
        <textarea maxLength={4000} rows={5} aria-label="Instruções para a IA" className="w-full rounded-xl border border-white/10 bg-background p-3 text-base" value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /><p className="text-xs text-muted">{form.instructions.length}/4000 · Não coloque senhas ou dados sensíveis.</p>
        <div className="flex flex-wrap gap-2">{templates.map((template) => <button key={template.name} type="button" className="min-h-11 rounded-lg border border-white/10 px-3 text-xs" onClick={() => setForm(template)}>{template.name}</button>)}</div>
        <label className="block text-sm">Tags sugeridas (skill é fixa)<TagInput value={form.tags} onChange={(tags) => { setTagsTouched(true); setForm({ ...form, tags }); }} fixed={['skill']} suggestions={suggestSkillTags(form.name, form.description, form.instructions, items.flatMap((item) => item.tags))} /></label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex gap-2"><button type="button" onClick={() => void save()} className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm text-primary">Salvar skill</button><button type="button" onClick={() => { setForm(null); setEditing(null); setImportNotice(null); }} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm">Cancelar</button></div>
      </section>}

      {query.isLoading && <p role="status">Carregando skills…</p>}{query.isError && <button onClick={() => void query.refetch()} className="min-h-11">Erro ao carregar. Tentar novamente</button>}
      {query.isSuccess && items.length === 0 && !form && <div className="rounded-2xl border border-dashed border-primary/20 p-8 text-center"><h3>Nenhuma skill ainda</h3><p className="mt-2 text-sm text-muted">Crie uma instrução reutilizável para orientar a IA.</p><button onClick={() => start(templates[0])} className="mt-3 min-h-11 rounded-xl border border-primary/30 px-4 text-primary">Criar primeira skill</button><button onClick={() => fileInput.current?.click()} className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary/10 px-4 text-primary"><FileUp className="h-4 w-4" />Importar arquivo .md</button></div>}
      {query.isSuccess && items.length > 0 && filtered.length === 0 && <div className="rounded-2xl border border-white/10 bg-surface/30 p-6 text-center"><p className="text-sm text-muted">Nenhuma skill encontrada.</p><button type="button" onClick={() => { setQ(''); setStatus('all'); setActiveTag(null); }} className="mt-2 min-h-11 text-xs text-primary">Limpar filtros</button></div>}
      {remove.isError && <p role="alert" className="text-sm text-danger">Não foi possível excluir a skill. Tente novamente.</p>}
      <div className="nexa-cards-grid">{filtered.map((skill) => <article key={skill.id} className="rounded-2xl border border-white/10 bg-surface/40 p-4"><div className="flex justify-between gap-2"><h3 className="font-semibold">{skill.name}</h3><label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={skill.enabled} onChange={(event) => toggle.mutate({ id: skill.id, enabled: event.target.checked })} />Usar</label></div>{skill.description && <p className="mt-2 text-sm text-muted">{skill.description}</p>}<p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted">{skill.instructions}</p><div className="mt-3 flex flex-wrap gap-1">{skill.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 px-2 py-1 text-2xs">#{tag}</span>)}</div><div className="mt-3 flex gap-2"><button onClick={() => start(skill)} className="min-h-11 rounded-lg border border-white/10 px-3 text-xs">Editar</button><button onClick={() => setConfirming(skill)} aria-label={`Excluir ${skill.name}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs"><Trash2 className="h-3 w-3" />Excluir</button></div>{confirming?.id === skill.id && <AlertDialog.Root open onOpenChange={(open) => { if (!open) setConfirming(null); }}><AlertDialog.Portal><AlertDialog.Overlay className="fixed inset-0 z-[89] nexa-modal-overlay backdrop-blur-sm" /><AlertDialog.Content aria-describedby={`delete-skill-${skill.id}`} className="fixed left-1/2 top-1/2 z-[90] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-5 shadow-2xl"><AlertDialog.Title className="font-semibold text-foreground">Excluir “{skill.name}”?</AlertDialog.Title><AlertDialog.Description id={`delete-skill-${skill.id}`} className="mt-2 text-sm text-muted">Essa skill será removida deste navegador.</AlertDialog.Description><div className="mt-4 flex justify-end gap-2"><AlertDialog.Cancel className="min-h-11 rounded-xl border border-white/10 px-4">Cancelar</AlertDialog.Cancel><AlertDialog.Action onClick={() => { remove.mutate(skill.id); setConfirming(null); }} className="min-h-11 rounded-xl bg-danger/10 px-4 text-danger">Excluir skill</AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>}</article>)}</div>
    </div>
  );
}

function quotaMessage(used: number, limit: number | null, role: string | null): string {
  if (limit === null) return 'Limite ilimitado.';
  if (used >= limit) return role === 'user' ? `Você usou ${used} de ${limit} skills. Exclua uma para criar outra.` : `Você usou ${used} de ${limit} skills. Entre com uma conta para ter até 5.`;
  return `O limite de ${limit} skills do modo ${role === 'user' ? 'Conta' : role === 'admin' ? 'Admin' : 'Convidado'} permite importar ${limit - used} arquivo(s).`;
}
