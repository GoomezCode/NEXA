import { useState, type KeyboardEvent } from 'react';

export function TagInput({ value, onChange, fixed = [], suggestions = [], max = 8 }: { value: string[]; onChange: (tags: string[]) => void; fixed?: string[]; suggestions?: string[]; max?: number }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().slice(0, 24);
    if (tag && ![...fixed, ...value].includes(tag) && fixed.length + value.length < max) onChange([...value, tag]);
    setDraft('');
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(draft); } };
  return <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-background p-2">
    {[...fixed, ...value].map(tag => <span key={tag} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-white/10 px-2 text-xs">#{tag}{fixed.includes(tag)?<span aria-label="tag fixa">🔒</span>:<button type="button" aria-label={`Remover tag ${tag}`} onClick={()=>onChange(value.filter(x=>x!==tag))}>×</button>}</span>)}
    <input aria-label="Adicionar tag" className="min-w-24 flex-1 bg-transparent px-2 py-1 text-sm outline-none" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={keyDown} onBlur={()=>{if(draft.trim())add(draft);}} placeholder="Adicionar tag" />
    {suggestions.filter(x=>![...fixed,...value].includes(x)).slice(0,4).map(tag=><button key={tag} type="button" onClick={()=>add(tag)} className="min-h-8 rounded-full border border-primary/20 px-2 text-xs text-primary">+ {tag}</button>)}
  </div>;
}
