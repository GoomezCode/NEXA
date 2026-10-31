import { useState } from 'react';
import { Brain, Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { useCreateMemory, useDeleteMemory, useMemories, useSetMemoryEnabled, useUpdateMemory } from '@/features/memory/api';

const mono = { fontFamily: 'Share Tech Mono, monospace' };
const raj = { fontFamily: 'Rajdhani, sans-serif' };

export function MemoryPanel() {
  const memories = useMemories();
  const create = useCreateMemory();
  const remove = useDeleteMemory();
  const setEnabled = useSetMemoryEnabled();
  const update = useUpdateMemory();
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const entries = (memories.data ?? []).filter((item) =>
    `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  );

  const add = async () => {
    if (!title.trim() || !content.trim()) return;
    await create.mutateAsync({ title, content, tags: [] });
    setTitle('');
    setContent('');
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-2"><Brain className="h-4 w-4" style={{ color: '#a855f7' }} /><span style={{ ...mono, color: '#a855f7', fontSize: '0.6875rem' }}>MEMÓRIAS LOCAIS</span></div>
      <label className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(0,8,25,0.6)', border: '1px solid rgba(168,85,247,0.2)' }}>
        <Search className="h-3.5 w-3.5" style={{ color: '#a855f7' }} />
        <input aria-label="Buscar memórias" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar memórias" className="min-w-0 flex-1 bg-transparent outline-none" style={{ ...raj, color: 'white' }} />
      </label>
      <div className="flex flex-col gap-2 rounded-xl p-2" style={{ background: 'rgba(0,8,25,0.5)', border: '1px solid rgba(168,85,247,0.15)' }}>
        <input aria-label="Título da memória" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="bg-transparent px-1 outline-none" style={{ ...raj, color: 'white' }} />
        <textarea aria-label="Conteúdo da memória" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Conteúdo" rows={2} className="resize-none bg-transparent px-1 outline-none" style={{ ...raj, color: 'white' }} />
        <button type="button" onClick={() => void add()} disabled={create.isPending || !title.trim() || !content.trim()} className="flex items-center justify-center gap-1 rounded-lg py-1.5 disabled:opacity-40" style={{ ...mono, color: '#d8b4fe', background: 'rgba(168,85,247,0.12)', fontSize: '0.6875rem' }}><Plus className="h-3 w-3" /> ADICIONAR</button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {memories.isLoading && <p style={{ ...raj, color: 'rgba(255,255,255,0.5)' }}>Carregando memórias…</p>}
        {entries.map((entry) => (
          <article key={entry.id} className="rounded-xl p-3" style={{ background: 'rgba(0,8,25,0.5)', border: '1px solid rgba(168,85,247,0.15)' }}>
            {editingId === entry.id ? (
              <div className="space-y-2">
                <input aria-label="Editar título da memória" value={title} onChange={(event) => setTitle(event.target.value)} className="w-full bg-transparent outline-none" style={{ ...raj, color: 'white' }} />
                <textarea aria-label="Editar conteúdo da memória" rows={3} value={content} onChange={(event) => setContent(event.target.value)} className="w-full resize-none bg-transparent outline-none" style={{ ...raj, color: 'white' }} />
                <div className="flex gap-3">
                  <button type="button" aria-label="Salvar memória" onClick={() => void update.mutateAsync({ id: entry.id, input: { title, content, tags: entry.tags } }).then(() => setEditingId(null))} className="text-green-300"><Check className="h-4 w-4" /></button>
                  <button type="button" aria-label="Cancelar edição" onClick={() => setEditingId(null)} className="text-muted"><X className="h-4 w-4" /></button>
                </div>
              </div>
            ) : <>
            <div className="flex items-start justify-between gap-2">
              <h3 style={{ ...raj, color: '#e9d5ff', fontSize: '13px' }}>{entry.title}</h3>
              <div className="flex gap-2">
                <button type="button" aria-label={`Editar ${entry.title}`} onClick={() => { setEditingId(entry.id); setTitle(entry.title); setContent(entry.content); }} className="text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label={`Excluir ${entry.title}`} onClick={() => remove.mutate(entry.id)} className="text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <p className="mt-1 line-clamp-3" style={{ ...raj, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{entry.content}</p>
            <label className="mt-2 flex items-center gap-2" style={{ ...mono, color: entry.enabled ? '#22c55e' : 'rgba(255,255,255,.4)', fontSize: '0.6875rem' }}>
              <input type="checkbox" checked={entry.enabled} onChange={(event) => setEnabled.mutate({ id: entry.id, enabled: event.target.checked })} /> USAR NESTA IA
            </label>
            </>}
          </article>
        ))}
        {!memories.isLoading && entries.length === 0 && <p style={{ ...raj, color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Nenhuma memória encontrada.</p>}
      </div>
    </div>
  );
}
