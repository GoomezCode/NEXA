import { Copy, Download, FileText, RefreshCw } from 'lucide-react';
import { lazy, memo, Suspense, useDeferredValue, useEffect, useState } from 'react';

import { formatFinishReason } from '@/api/chat';
import { namespace } from '@/api';
import type { ChatMessage } from '@/api/types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useStreamStore } from '@/stores/stream-store';
import { createAttachmentStore } from './attachments/store';
import { formatBytes } from './attachments/validate';

const MarkdownContent = lazy(() =>
  import('./MarkdownContent').then((module) => ({ default: module.MarkdownContent })),
);
const AttachmentLightbox = lazy(() => import('./AttachmentLightbox'));

interface AttachmentUrls { url: string; thumbUrl?: string }

const STATUS_NOTE: Partial<Record<ChatMessage['status'], string>> = {
  stopped: 'Resposta interrompida',
  error: 'Falha ao gerar a resposta',
};

export const MessageBubble = memo(function MessageBubble({
  message,
  onRetry,
  canRetry = false,
}: {
  message: ChatMessage;
  onRetry?: () => void;
  canRetry?: boolean;
}) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const note = STATUS_NOTE[message.status];
  const [copied, setCopied] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, AttachmentUrls | null>>({});
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const attachmentIds = message.attachments?.map((item) => item.id).join('|') ?? '';
  const attachmentNamespace = namespace();
  useEffect(() => {
    const attachments = message.attachments ?? [];
    if (!attachments.length) {
      setAttachmentUrls({});
      return;
    }
    let cancelled = false;
    const urls: string[] = [];
    const load = async () => {
      const store = createAttachmentStore(attachmentNamespace);
      const stored = await store.getMany(attachments.map((item) => item.id));
      if (cancelled) return;
      const next: Record<string, AttachmentUrls | null> = {};
      stored.forEach((entry, index) => {
        const meta = attachments[index];
        if (!meta) return;
        if (!entry) { next[meta.id] = null; return; }
        const url = URL.createObjectURL(entry.blob);
        urls.push(url);
        const thumbUrl = entry.thumb ? URL.createObjectURL(entry.thumb) : undefined;
        if (thumbUrl) urls.push(thumbUrl);
        next[meta.id] = { url, ...(thumbUrl ? { thumbUrl } : {}) };
      });
      setAttachmentUrls(next);
    };
    void load();
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  // IDs identify immutable message attachments; namespace changes load from the matching store.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, attachmentIds, attachmentNamespace]);
  const activeStream = useStreamStore((state) => state.messageId === message.id ? state.content : null);
  const content = isStreaming ? activeStream ?? message.content : message.content;
  const deferredContent = useDeferredValue(content);

  return (
    <article
      className={cn('flex w-full flex-col gap-2', isUser ? 'items-end' : 'items-start')}
      aria-label={isUser ? 'Sua mensagem' : 'Mensagem da NEXA'}
    >
      <div
        className={cn(
          'min-w-0 w-full',
          isUser && 'nexa-user-message max-w-[min(88%,38rem)]',
        )}
      >
        {isUser && message.attachments?.length ? (
          <div className="mb-3 flex max-w-full flex-wrap justify-end gap-2" aria-label="Anexos enviados">
            {message.attachments.filter((attachment) => attachment.kind === 'image').slice(0, 4).map((attachment) => {
              const urls = attachmentUrls[attachment.id];
              return urls ? (
                <button key={attachment.id} type="button" onClick={() => setLightboxId(attachment.id)} className="min-h-11 min-w-11 overflow-hidden rounded-xl border border-border bg-surface-2" aria-label={`Ampliar imagem: ${attachment.name}`}>
                  <img src={urls.thumbUrl ?? urls.url} alt={attachment.name} className="h-24 w-24 object-cover sm:h-28 sm:w-28" />
                </button>
              ) : (
                <span key={attachment.id} className="inline-flex min-h-11 max-w-56 items-center rounded-xl border border-border bg-surface-2 px-3 text-xs text-muted">
                  {urls === null ? 'Anexo indisponível' : `Carregando ${attachment.name}…`}
                </span>
              );
            })}
            {message.attachments.filter((attachment) => attachment.kind !== 'image').map((attachment) => {
              const urls = attachmentUrls[attachment.id];
              return urls ? (
                <a key={attachment.id} href={urls.url} download={attachment.name} className="flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-left text-xs text-foreground hover:bg-surface-3" aria-label={`Baixar anexo: ${attachment.name}, ${formatBytes(attachment.size)}`}>
                  <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="min-w-0"><span className="block truncate">{attachment.name}</span><span className="text-muted">{attachment.kind.toUpperCase()} · {formatBytes(attachment.size)}</span></span>
                  <Download className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </a>
              ) : (
                <span key={attachment.id} className="inline-flex min-h-11 max-w-56 items-center rounded-xl border border-border bg-surface-2 px-3 text-xs text-muted">{urls === null ? 'Anexo indisponível' : `Carregando ${attachment.name}…`}</span>
              );
            })}
            {lightboxId && attachmentUrls[lightboxId] && (
              <Suspense fallback={null}>
                <AttachmentLightbox open onOpenChange={(open) => { if (!open) setLightboxId(null); }} src={attachmentUrls[lightboxId].url} alt={message.attachments.find((attachment) => attachment.id === lightboxId)?.name ?? 'Imagem anexada'} />
              </Suspense>
            )}
          </div>
        ) : null}
        {isUser ? (
          <p className="whitespace-pre-wrap text-base leading-relaxed">{message.content}</p>
        ) : (
          <div className="nexa-markdown">
            {isStreaming && !deferredContent.trim() ? (
              <span className="nexa-thinking" role="status" aria-label="NEXA está pensando">
                <i /><i /><i />
              </span>
            ) : (
              <>
                <Suspense fallback={<p className="whitespace-pre-wrap">{content}</p>}>
                  <MarkdownContent content={isStreaming ? deferredContent : content} />
                </Suspense>
                {isStreaming && <span className="nexa-caret" aria-hidden="true" />}
              </>
            )}
          </div>
        )}

        <div
          className={cn(
            'nexa-message-meta mt-2 flex flex-wrap items-center gap-2 text-xs text-muted',
            isUser && 'justify-end',
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isStreaming && <span>Respondendo</span>}
          {note && (
            <span className={message.status === 'error' ? 'text-danger' : 'text-warning'}>
              {note}
            </span>
          )}
          {!isUser && message.status === 'done' && message.finish_reason && <span>{formatFinishReason(message.finish_reason)}</span>}
          {!isUser && message.status === 'done' && (message.memoriesUsed ?? 0) > 0 && <span>{message.memoriesUsed} {message.memoriesUsed === 1 ? 'memória usada' : 'memórias usadas'}</span>}
        </div>
        {!isUser && message.status === 'done' && (
          <div className="nexa-message-actions mt-1 flex items-center gap-1">
            <button
              type="button"
              className="nexa-message-action"
              aria-label={copied ? 'Copiado!' : 'Copiar resposta'}
              onClick={() => {
                void (async () => {
                  try {
                    await navigator.clipboard.writeText(message.content);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  } catch {
                    setCopied(false);
                  }
                })();
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            {canRetry && onRetry && (
              <button type="button" className="nexa-message-action" onClick={onRetry} aria-label="Tentar novamente">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Tentar novamente
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
