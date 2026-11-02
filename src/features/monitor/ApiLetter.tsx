import { useState } from 'react';
import { ArrowUpRight, Check, Copy, ExternalLink, Mail, X } from 'lucide-react';
import * as m from 'motion/react-m';
import * as Dialog from '@radix-ui/react-dialog';

import { apiOrigin } from '@/api/config';
import { useApiHealth } from '@/api/health';
import { useSettingsStore } from '@/stores/settings-store';

const examples = [
  {
    id: 'openai',
    title: 'OpenAI SDK',
    body: `from openai import OpenAI\n\nclient = OpenAI(\n    api_key="<NEXA_API_KEY>",\n    base_url="{{origin}}/v1",\n)\n\nresponse = client.chat.completions.create(\n    model="ollama/llama3.1:latest",\n    messages=[{"role": "user", "content": "Olá!"}],\n)`,
  },
  {
    id: 'anthropic',
    title: 'Claude Code / Anthropic',
    body: `export ANTHROPIC_BASE_URL="{{origin}}"\nexport ANTHROPIC_API_KEY="<NEXA_API_KEY>"`,
  },
  {
    id: 'ollama',
    title: 'Cliente compatível com Ollama',
    body: `curl "{{origin}}/api/tags" \\\n  -H "Authorization: Bearer <NEXA_API_KEY>"\n\ncurl "{{origin}}/api/chat" \\\n  -H "Authorization: Bearer <NEXA_API_KEY>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"ollama/llama3.1:latest","messages":[{"role":"user","content":"Olá!"}],"stream":false}'`,
  },
];

export function ApiLetter() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const health = useApiHealth();
  const apiUrl = useSettingsStore((state) => state.settings.apiUrl);
  const origin = apiOrigin(apiUrl) || (typeof window === 'undefined' ? '' : window.location.origin);

  const copy = async (id: string, body: string) => {
    try {
      await navigator.clipboard.writeText(body.replaceAll('{{origin}}', origin));
      setCopied(id);
      setCopyError(false);
      window.setTimeout(() => setCopied((current) => current === id ? null : current), 1800);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><m.button type="button" whileHover={{ y: -2 }} whileTap={{ scale: .985 }} className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[.1] via-surface/70 to-surface/40 p-4 text-left nexa-themed-shadow transition hover:border-primary/35 sm:p-5">
        <span className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-primary/8 blur-2xl transition group-hover:bg-primary/15" aria-hidden="true" />
        <span className="relative flex h-14 w-16 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-background/70 text-primary shadow-inner">
          <Mail className="h-7 w-7" strokeWidth={1.35} aria-hidden="true" />
          <m.span aria-hidden="true" className="absolute inset-x-0 top-0 h-7 origin-top rounded-t-xl border-b border-primary/15 bg-primary/[.08]" animate={{ rotateX: open ? -160 : 0 }} transition={{ type: 'spring', stiffness: 180, damping: 16 }} style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block font-mono text-2xs uppercase tracking-[0.2em] text-primary/70">uma correspondência para você</span>
          <span className="mt-1 block font-display text-base tracking-wide text-foreground">Carta de integração</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted">Endereços úteis e exemplos para conectar seus clientes à API NEXA.</span>
        </span>
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/8 text-primary transition group-hover:translate-x-0.5 group-hover:bg-primary/15"><ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>
      </m.button></Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay asChild><m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="nexa-modal-overlay fixed inset-0 z-[180] flex items-center justify-center overflow-y-auto p-3 backdrop-blur-md sm:p-6" /></Dialog.Overlay>
        <Dialog.Content asChild>
            <m.article initial={{ opacity: 0, y: 24, scale: .96, rotateX: 3 }} animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }} transition={{ type: 'spring', stiffness: 230, damping: 23 }} className="nexa-themed-shadow fixed left-1/2 top-1/2 z-[181] my-auto w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[22px] border border-border bg-surface text-foreground">
              <div className="relative max-h-[92vh] overflow-y-auto p-5 sm:p-8">
                <Dialog.Close asChild><m.button type="button" whileHover={{ rotate: 90, scale: 1.05 }} whileTap={{ scale: .92 }} aria-label="Fechar carta" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition hover:bg-foreground/5"><X className="h-4 w-4" /></m.button></Dialog.Close>
                <div className="flex items-start justify-between gap-4 border-b border-border pb-5 pr-10">
                  <div><p className="font-mono text-2xs uppercase tracking-[.22em] text-primary">Correspondência · NEXA API</p><h2 id="api-letter-title" className="mt-2 font-display text-2xl tracking-wide text-foreground">Olá, operador.</h2><p className="mt-1 text-sm text-muted">Sua carta de integração chegou.</p></div>
                  <span className="flex h-14 w-14 shrink-0 rotate-3 items-center justify-center border border-dashed border-primary/50 bg-primary/5 font-display text-xs tracking-widest text-primary">NEXA<br />API</span>
                </div>

                <div className="py-5">
                  <p className="text-sm leading-relaxed text-foreground">Use os endereços abaixo para consultar a documentação ou conectar uma ferramenta compatível. A origem configurada é <code className="break-all rounded bg-surface-2 px-1.5 py-0.5 font-mono text-2xs">{origin || 'não configurada'}</code>{health.data?.version ? <> e a API está na versão <strong>{health.data.version}</strong></> : null}.</p>
                  <nav aria-label="Documentação da API" className="mt-4 flex flex-wrap gap-2">
                    {[["Swagger", "/docs"], ["ReDoc", "/redoc"], ["OpenAPI JSON", "/openapi.json"]].map(([label, path]) => <a key={path} href={`${origin}${path}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 text-xs text-primary transition hover:border-primary/45 hover:bg-surface-2"><ExternalLink className="h-3 w-3" aria-hidden="true" />{label}</a>)}
                  </nav>
                </div>

                <div className="space-y-3 border-t border-border pt-5">
                  <div><h3 className="font-display text-sm tracking-wide text-foreground">Exemplos para seus clientes</h3><p className="mt-1 text-xs text-muted">Copie um exemplo e substitua <code className="font-mono">&lt;NEXA_API_KEY&gt;</code> por uma chave emitida pelo administrador.</p></div>
                  {examples.map((example) => <section key={example.id} className="overflow-hidden rounded-xl border border-border bg-surface/55">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2"><h4 className="text-xs font-semibold text-foreground">{example.title}</h4><button type="button" onClick={() => void copy(example.id, example.body)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 font-mono text-2xs uppercase tracking-wider text-primary transition hover:bg-primary/5" aria-label={`Copiar exemplo ${example.title}`}>{copied === example.id ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}{copied === example.id ? 'Copiado' : 'Copiar'}</button></div>
                    <pre className="max-h-48 overflow-auto p-3 font-mono text-2xs leading-relaxed text-foreground"><code>{example.body.replaceAll('{{origin}}', origin)}</code></pre>
                  </section>)}
                  {copyError && <p role="alert" className="text-xs text-danger">Não foi possível copiar; selecione o exemplo para copiá-lo manualmente.</p>}
                  <p className="rounded-lg border border-border bg-primary/5 p-3 text-xs leading-relaxed text-muted">As chaves de compatibilidade são configuradas pelo administrador no servidor via <code className="font-mono">COMPAT_API_KEYS</code>. Nunca coloque chaves de provedor ou segredos pessoais nestes exemplos.</p>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-border pt-4 font-mono text-2xs uppercase tracking-[.15em] text-muted"><span>Com carinho,</span><span>Equipe NEXA</span></div>
              </div>
            </m.article>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
