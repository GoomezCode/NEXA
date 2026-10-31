import { useState } from 'react';
import { Check, ChevronDown, CircleCheck, FlaskConical, KeyRound, LockKeyhole, Save, Trash2 } from 'lucide-react';

import {
  providerKeyLabels,
  useDeleteProviderKey,
  useProviderKeys,
  useSaveProviderKey,
  useTestProviderKey,
  type ProviderName,
} from '@/api/provider-keys';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';

const PROVIDER_ORDER: ProviderName[] = ['openai', 'anthropic', 'google', 'ollama_cloud', 'nvidia', 'openai_compatible'];
const PROVIDER_HELP: Record<ProviderName, string> = {
  openai: 'OpenAI e modelos da plataforma',
  anthropic: 'Claude e modelos Anthropic',
  google: 'Gemini e modelos Google',
  ollama_cloud: 'Modelos hospedados no Ollama Cloud',
  nvidia: 'Modelos NVIDIA NIM com chave e URL base',
  openai_compatible: 'Groq, OpenRouter e APIs compatíveis',
};

export function ProviderKeysPanel({ compact = false }: { compact?: boolean }) {
  const session = useAuthStore((state) => state.session);
  const setActiveView = useUiStore((state) => state.setActiveView);
  const canManage = Boolean(session && session.role !== 'guest');
  const keys = useProviderKeys(canManage);
  const save = useSaveProviderKey();
  const remove = useDeleteProviderKey();
  const test = useTestProviderKey();
  const [expanded, setExpanded] = useState<ProviderName | null>(null);
  const [secrets, setSecrets] = useState<Partial<Record<ProviderName, string>>>({});
  const [baseUrls, setBaseUrls] = useState<Partial<Record<ProviderName, string>>>({});
  const [models, setModels] = useState<Partial<Record<ProviderName, string>>>({});
  const [feedback, setFeedback] = useState<{ provider: ProviderName; text: string; error?: boolean } | null>(null);
  const saved = new Map((keys.data ?? []).map((item) => [item.provider, item]));

  const saveKey = async (provider: ProviderName) => {
    setFeedback(null);
    const secret = secrets[provider]?.trim();
    if (!secret) {
      setFeedback({ provider, text: 'Cole a chave que deseja salvar ou substituir.', error: true });
      return;
    }
    try {
      await save.mutateAsync({
        provider,
        input: {
          api_key: secret,
          ...(['nvidia', 'openai_compatible'].includes(provider) && baseUrls[provider]?.trim() ? { base_url: baseUrls[provider]!.trim() } : {}),
          ...(models[provider]?.trim() ? { default_model: models[provider]!.trim() } : {}),
        },
      });
      setSecrets((current) => ({ ...current, [provider]: '' }));
      setFeedback({ provider, text: 'Chave salva com segurança. O formulário foi limpo.' });
    } catch (error) {
      setFeedback({ provider, text: error instanceof Error ? error.message : 'Não foi possível salvar a chave.', error: true });
    }
  };

  return (
    <section aria-labelledby="monitor-provider-keys-title" className="rounded-2xl border border-border bg-surface/50 p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/8 text-primary"><KeyRound className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <h3 id="monitor-provider-keys-title" className="font-display text-2xs tracking-[0.2em] text-primary">SUAS CHAVES DE IA</h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">Conecte suas próprias contas. As chaves ficam cifradas na API e nunca são exibidas novamente.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/5 px-2.5 py-1 font-mono text-2xs uppercase tracking-wider text-success"><LockKeyhole className="h-3 w-3" aria-hidden="true" />Cifradas no servidor</span>
      </header>

      {!canManage ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-background/35 p-3">
          <p className="text-xs leading-relaxed text-muted">Entre ou crie uma conta para configurar chaves próprias. Convidados podem usar os provedores habilitados pelo servidor.</p>
          <button type="button" onClick={() => setActiveView('settings')} className="min-h-10 rounded-lg border border-primary/25 bg-primary/8 px-3 font-mono text-2xs uppercase tracking-wider text-primary transition hover:bg-primary/15">Entrar ou criar conta</button>
        </div>
      ) : (
        <>
          {keys.isError && <p role="alert" className="mt-3 rounded-lg border border-danger/20 bg-danger/5 p-2.5 text-xs text-danger">Não foi possível carregar suas chaves. Tente atualizar o Monitor.</p>}
          <div className={cn('mt-4 grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
            {PROVIDER_ORDER.map((provider) => {
              const entry = saved.get(provider);
              const isOpen = expanded === provider;
              const savedLabel = entry ? `Chave salva ····${entry.key_last4}` : 'Nenhuma chave configurada';
              return (
                <article key={provider} className={cn('overflow-hidden rounded-xl border transition-colors', isOpen ? 'border-primary/30 bg-primary/[.035] sm:col-span-2' : 'border-white/8 bg-background/30 hover:border-white/15')}>
                  <button type="button" aria-expanded={isOpen} onClick={() => { setFeedback(null); setExpanded(isOpen ? null : provider); }} className="flex min-h-[68px] w-full items-center gap-3 px-3 py-2.5 text-left">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', entry ? 'border-success/20 bg-success/5 text-success' : 'border-white/8 bg-white/[.025] text-muted')}>
                      {entry ? <CircleCheck className="h-4 w-4" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-foreground">{providerKeyLabels[provider]}</span>
                      <span className="mt-0.5 block truncate text-2xs text-muted/75">{entry ? savedLabel : PROVIDER_HELP[provider]}</span>
                    </span>
                    <span className="font-mono text-2xs uppercase tracking-wider text-muted">{entry ? 'Configurado' : 'Configurar'}</span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', isOpen && 'rotate-180 text-primary')} aria-hidden="true" />
                  </button>

                  {isOpen && (
                    <div className={cn('grid gap-3 border-t border-white/6 p-3', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
                      <div className="space-y-2.5">
                        <div>
                          <label htmlFor={`monitor-provider-key-${provider}`} className="mb-1 block text-2xs font-mono uppercase tracking-wider text-muted">Chave secreta</label>
                          <input id={`monitor-provider-key-${provider}`} type="password" autoComplete="new-password" value={secrets[provider] ?? ''} onChange={(event) => setSecrets((current) => ({ ...current, [provider]: event.target.value }))} placeholder={entry ? 'Cole uma nova chave para substituir' : 'Cole sua chave de API'} className="min-h-11 w-full rounded-lg border border-white/10 bg-background/70 px-3 font-mono text-xs text-foreground outline-none transition focus:border-primary/40" />
                          <p className="mt-1 text-2xs text-muted/70">A chave não pode ser recuperada nesta tela. Para trocar, informe uma nova.</p>
                        </div>
                        {['nvidia', 'openai_compatible'].includes(provider) && <div><label htmlFor={`monitor-provider-base-url-${provider}`} className="mb-1 block text-2xs font-mono uppercase tracking-wider text-muted">URL base HTTPS</label><input id={`monitor-provider-base-url-${provider}`} type="url" value={baseUrls[provider] ?? entry?.base_url ?? ''} onChange={(event) => setBaseUrls((current) => ({ ...current, [provider]: event.target.value }))} placeholder={provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : 'https://api.provedor.com/v1'} className="min-h-11 w-full rounded-lg border border-white/10 bg-background/70 px-3 font-mono text-xs text-foreground outline-none transition focus:border-primary/40" /><p className="mt-1 text-2xs text-muted/70">{provider === 'nvidia' ? 'Opcional. Vazio usa o endpoint hospedado padrão da NVIDIA.' : 'Informe o endpoint base do provedor.'}</p></div>}
                      </div>
                      <div className="flex flex-col justify-between gap-3">
                        <div><label htmlFor={`monitor-provider-model-${provider}`} className="mb-1 block text-2xs font-mono uppercase tracking-wider text-muted">Modelo padrão <span className="normal-case tracking-normal">(opcional)</span></label><input id={`monitor-provider-model-${provider}`} value={models[provider] ?? entry?.default_model ?? ''} onChange={(event) => setModels((current) => ({ ...current, [provider]: event.target.value }))} placeholder={provider === 'nvidia' ? 'meta/llama-3.1-8b-instruct' : 'Ex.: gpt-4o-mini'} className="min-h-11 w-full rounded-lg border border-white/10 bg-background/70 px-3 font-mono text-xs text-foreground outline-none transition focus:border-primary/40" />
                          <p className="mt-1 text-2xs text-muted/70">{provider === 'nvidia' ? 'Use um modelo NVIDIA listado no catálogo de chat, por exemplo meta/llama-3.1-8b-instruct.' : 'Se vazio, o servidor usa o modelo padrão do provedor.'}</p></div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void saveKey(provider)} disabled={save.isPending} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 font-mono text-2xs uppercase tracking-wider text-primary transition hover:bg-primary/15 disabled:opacity-50"><Save className="h-3.5 w-3.5" aria-hidden="true" />Salvar chave</button>
                          <button type="button" onClick={() => test.mutate(provider, { onSuccess: (result) => setFeedback({ provider, text: result.message }), onError: () => setFeedback({ provider, text: 'Não foi possível testar esta chave.', error: true }) })} disabled={!entry || test.isPending} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/10 px-3 font-mono text-2xs uppercase tracking-wider text-muted transition hover:border-primary/25 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"><FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />Testar</button>
                          {entry && <button type="button" onClick={() => remove.mutate(provider, { onSuccess: () => setFeedback({ provider, text: 'Chave removida.' }), onError: () => setFeedback({ provider, text: 'Não foi possível remover esta chave.', error: true }) })} disabled={remove.isPending} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-danger/15 px-3 font-mono text-2xs uppercase tracking-wider text-danger transition hover:bg-danger/5 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remover</button>}
                        </div>
                      </div>
                      {feedback?.provider === provider && <p role={feedback.error ? 'alert' : 'status'} className={cn('sm:col-span-2 rounded-lg border p-2.5 text-xs', feedback.error ? 'border-danger/20 bg-danger/5 text-danger' : 'border-success/20 bg-success/5 text-success')}>{!feedback.error && <Check className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />}{feedback.text}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
