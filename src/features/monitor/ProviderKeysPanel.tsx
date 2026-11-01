import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, ChevronDown, CircleCheck, FlaskConical, KeyRound, LockKeyhole, Save, Trash2 } from 'lucide-react';

import {
  providerKeyLabels,
  useDeleteProviderKey,
  useProviderKeys,
  useSaveProviderKey,
  useTestProviderKey,
  type ProviderName,
  type ProviderKeySummary,
} from '@/api/provider-keys';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';

const PROVIDER_ORDER: ProviderName[] = ['openai', 'anthropic', 'google', 'ollama_cloud', 'nvidia', 'openai_compatible'];
const PROVIDER_HELP: Record<ProviderName, string> = {
  openai: 'OpenAI e modelos da plataforma',
  anthropic: 'Claude e modelos Anthropic',
  google: 'Gemini e modelos Google',
  ollama_cloud: 'Modelos hospedados no Ollama Cloud',
  nvidia: 'Modelos NVIDIA NIM com chave e URL base',
  openai_compatible: 'Groq, OpenRouter e APIs compatíveis',
};

const providerSecretSchema = z.object({
  secret: z.string().trim().min(1, 'Informe a chave de API.'),
  baseUrl: z.string(),
  defaultModel: z.string().trim().max(160, 'Use até 160 caracteres.'),
}).superRefine((values, context) => {
  if (!values.baseUrl.trim()) return;
  try {
    if (new URL(values.baseUrl).protocol !== 'https:') throw new Error('https');
  } catch {
    context.addIssue({ code: 'custom', path: ['baseUrl'], message: 'Informe uma URL HTTPS válida.' });
  }
});

type ProviderSecretValues = z.infer<typeof providerSecretSchema>;

export function ProviderKeysPanel({ compact = false }: { compact?: boolean }) {
  const session = useAuthStore((state) => state.session);
  const demoMode = useSettingsStore((state) => state.settings.demoMode);
  const navigate = useNavigate();
  const canManage = Boolean(session && session.role !== 'guest');
  const keys = useProviderKeys(canManage && !demoMode);
  const save = useSaveProviderKey();
  const remove = useDeleteProviderKey();
  const test = useTestProviderKey();
  const [expanded, setExpanded] = useState<ProviderName | null>(null);
  const [feedback, setFeedback] = useState<{ provider: ProviderName; text: string; error?: boolean } | null>(null);
  const saved = new Map((Array.isArray(keys.data) ? keys.data : []).map((item) => [item.provider, item]));

  const saveKey = async (provider: ProviderName, values: ProviderSecretValues) => {
    setFeedback(null);
    try {
      await save.mutateAsync({
        provider,
        input: {
          api_key: values.secret,
          ...(['nvidia', 'openai_compatible'].includes(provider) && values.baseUrl.trim() ? { base_url: values.baseUrl.trim() } : {}),
          ...(values.defaultModel.trim() ? { default_model: values.defaultModel.trim() } : {}),
        },
      });
      setFeedback({ provider, text: 'Chave salva com segurança. O formulário foi limpo.' });
      return true;
    } catch (error) {
      setFeedback({ provider, text: error instanceof Error ? error.message : 'Não foi possível salvar a chave.', error: true });
      return false;
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

      {!canManage || demoMode ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-background/35 p-3">
          <p className="text-xs leading-relaxed text-muted">{demoMode ? 'Desative o modo demonstração para configurar chaves de provedores.' : 'Entre ou crie uma conta para configurar chaves próprias. Convidados podem usar os provedores habilitados pelo servidor.'}</p>
<button type="button" onClick={() => navigate('/settings')} className="min-h-10 rounded-lg border border-primary/25 bg-primary/8 px-3 font-mono text-2xs uppercase tracking-wider text-primary transition hover:bg-primary/15">{demoMode ? 'Abrir Ajustes' : 'Entrar ou criar conta'}</button>
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
                    <ProviderCredentialForm
                      provider={provider}
                      entry={entry}
                      compact={compact}
                      saving={save.isPending}
                      testing={test.isPending}
                      removing={remove.isPending}
                      feedback={feedback?.provider === provider ? feedback : null}
                      onSave={(values) => saveKey(provider, values)}
                      onTest={() => test.mutate(provider, { onSuccess: (result) => setFeedback({ provider, text: result.message }), onError: () => setFeedback({ provider, text: 'Não foi possível testar esta chave.', error: true }) })}
                      onRemove={() => remove.mutate(provider, { onSuccess: () => setFeedback({ provider, text: 'Chave removida.' }), onError: () => setFeedback({ provider, text: 'Não foi possível remover esta chave.', error: true }) })}
                    />
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

function ProviderCredentialForm({
  provider,
  entry,
  compact,
  saving,
  testing,
  removing,
  feedback,
  onSave,
  onTest,
  onRemove,
}: {
  provider: ProviderName;
  entry: ProviderKeySummary | undefined;
  compact: boolean;
  saving: boolean;
  testing: boolean;
  removing: boolean;
  feedback: { text: string; error?: boolean } | null;
  onSave: (values: ProviderSecretValues) => Promise<boolean>;
  onTest: () => void;
  onRemove: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProviderSecretValues>({
    resolver: zodResolver(providerSecretSchema),
    mode: 'onBlur',
    defaultValues: { secret: '', baseUrl: entry?.base_url ?? '', defaultModel: entry?.default_model ?? '' },
  });
  const submit = handleSubmit(async (values) => {
    if (await onSave(values)) reset({ ...values, secret: '' });
  });
  const customProvider = provider === 'nvidia' || provider === 'openai_compatible';

  return (
    <form onSubmit={(event) => void submit(event)} className={cn('grid gap-3 border-t border-white/6 p-3', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
      <div className="space-y-2.5">
        <div>
          <Field id={`monitor-provider-key-${provider}`} label="Chave secreta" type="password" autoComplete="new-password" placeholder={entry ? 'Cole uma nova chave para substituir' : 'Cole sua chave de API'} error={errors.secret?.message} {...register('secret')} />
          <p className="mt-1 text-xs text-muted/70">A chave não pode ser recuperada nesta tela. Para trocar, informe uma nova.</p>
        </div>
        {customProvider && <div>
          <Field id={`monitor-provider-base-url-${provider}`} label="URL base HTTPS" type="url" placeholder={provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : 'https://api.provedor.com/v1'} error={errors.baseUrl?.message} {...register('baseUrl')} />
          <p className="mt-1 text-xs text-muted/70">{provider === 'nvidia' ? 'Opcional. Vazio usa o endpoint hospedado padrão da NVIDIA.' : 'Informe o endpoint HTTPS do provedor.'}</p>
        </div>}
      </div>
      <div className="flex flex-col justify-between gap-3">
        <div>
          <Field id={`monitor-provider-model-${provider}`} label="Modelo padrão (opcional)" placeholder={provider === 'nvidia' ? 'meta/llama-3.1-8b-instruct' : 'Ex.: gpt-4o-mini'} error={errors.defaultModel?.message} {...register('defaultModel')} />
          <p className="mt-1 text-xs text-muted/70">Se vazio, o servidor usa o modelo padrão do provedor.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={saving}><Save className="h-3.5 w-3.5" aria-hidden="true" />Salvar chave</Button>
          <Button type="button" onClick={onTest} disabled={!entry || testing}><FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />Testar</Button>
          {entry && <Button type="button" variant="danger" onClick={onRemove} disabled={removing}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remover</Button>}
        </div>
      </div>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={cn('sm:col-span-2 rounded-lg border p-2.5 text-xs', feedback.error ? 'border-danger/20 bg-danger/5 text-danger' : 'border-success/20 bg-success/5 text-success')}>{!feedback.error && <Check className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />}{feedback.text}</p>}
    </form>
  );
}
