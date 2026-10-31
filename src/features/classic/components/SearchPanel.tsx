import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { getChatAdapter } from '@/api';
import { messageKeys, useSessions } from '@/features/chat/api';
import { useApp } from '../ClassicContext';

const mono = { fontFamily: 'Share Tech Mono, monospace' };
const raj = { fontFamily: 'Rajdhani, sans-serif' };

export function SearchPanel() {
  const { memories } = useApp();
  const sessions = useSessions();
  const [query, setQuery] = useState('');
  const conversationQueries = useQueries({
    queries: (sessions.data ?? []).map((session) => ({
      queryKey: messageKeys.session(session.id),
      queryFn: () => getChatAdapter().listMessages(session.id),
      enabled: Boolean(query.trim()),
    })),
  });
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];
    return [
      ...conversationQueries.flatMap((result, index) => (result.data ?? [])
        .filter((message) => message.content.toLocaleLowerCase().includes(term))
        .map((message) => ({
          id: `message-${message.id}`, type: 'CONVERSA', title: sessions.data?.[index]?.title ?? (message.role === 'user' ? 'Você' : 'NEXA'), text: message.content,
        }))),
      ...memories.filter((memory) => `${memory.title} ${memory.content} ${memory.tags.join(' ')}`.toLocaleLowerCase().includes(term)).map((memory) => ({
        id: `memory-${memory.id}`, type: 'MEMÓRIA', title: memory.title, text: memory.content,
      })),
    ];
  }, [conversationQueries, memories, query, sessions.data]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-2"><Search className="h-4 w-4" style={{ color: '#0ea5e9' }} /><span style={{ ...mono, color: '#0ea5e9', fontSize: '0.6875rem' }}>BUSCA LOCAL</span></div>
      <label className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(0,8,25,0.7)', border: '1px solid rgba(14,165,233,0.25)' }}>
        <Search className="h-3.5 w-3.5" style={{ color: '#0ea5e9' }} />
        <input aria-label="Buscar conversas e memórias" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversas e memórias" className="min-w-0 flex-1 bg-transparent outline-none" style={{ ...raj, color: 'rgba(255,255,255,.85)', fontSize: '13px' }} />
      </label>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {!query.trim() && <p style={{ ...raj, color: 'rgba(255,255,255,.45)', fontSize: '12px' }}>Pesquise no histórico das conversas e nas memórias salvas neste navegador.</p>}
        {results.map((result) => (
          <article key={result.id} className="rounded-xl p-3" style={{ background: 'rgba(0,8,25,.5)', border: '1px solid rgba(14,165,233,.16)' }}>
            <div className="flex items-center justify-between"><h3 style={{ ...raj, color: 'rgba(255,255,255,.85)', fontSize: '13px' }}>{result.title}</h3><span style={{ ...mono, color: '#0ea5e9', fontSize: '0.6875rem' }}>{result.type}</span></div>
            <p className="mt-1 line-clamp-4 break-words" style={{ ...raj, color: 'rgba(255,255,255,.55)', fontSize: '12px' }}>{result.text}</p>
          </article>
        ))}
        {query.trim() && results.length === 0 && <p style={{ ...raj, color: 'rgba(255,255,255,.45)', fontSize: '12px' }}>Nenhum resultado local.</p>}
      </div>
    </div>
  );
}
