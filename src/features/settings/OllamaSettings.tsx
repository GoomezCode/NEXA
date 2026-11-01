import { Plug } from 'lucide-react';
import { useState } from 'react';

import { ollamaVersion } from '@/api/ollama';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { SectionCard } from '@/components/ui/Panel';
import { useAuthStore } from '@/stores/auth-store';
import { useConnectionStore } from '@/stores/connection-store';

export function OllamaSettings() {
  const mode = useConnectionStore((state) => state.mode);
  const ollamaUrl = useConnectionStore((state) => state.ollamaUrl);
  const numCtx = useConnectionStore((state) => state.numCtx);
  const setMode = useConnectionStore((state) => state.setMode);
  const setConfig = useConnectionStore((state) => state.setOllamaConfig);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <SectionCard id="settings-offline" title="MODO OFFLINE (OLLAMA)" icon={Plug}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="settings-ollama-url" label="URL local" value={ollamaUrl} onChange={(event) => setConfig(event.target.value, numCtx)} />
        <Field id="settings-ollama-context" label="Contexto (num_ctx)" type="number" min={512} max={131072} step={512} value={numCtx} onChange={(event) => setConfig(ollamaUrl, Math.max(512, Number(event.target.value) || 4096))} />
      </div>
      <p className="text-xs leading-relaxed text-muted">Use <code>/ollama</code> pelo proxy same-origin. URLs diretas aceitam somente localhost ou loopback.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setError(null); setStatus(null); void ollamaVersion().then((version) => setStatus(`Ollama ${version} conectado`)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Falha ao conectar.')); }}>Testar conexão</Button>
        <Button variant="primary" onClick={() => { if (mode === 'offline') { setMode('api'); useAuthStore.getState().clear(); } else setMode('offline'); }}>{mode === 'offline' ? 'Sair do offline' : 'Entrar no offline'}</Button>
      </div>
      {status && <p role="status" className="text-xs text-success">{status}</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </SectionCard>
  );
}
