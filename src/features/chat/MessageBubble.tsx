import { Copy, RefreshCw } from 'lucide-react';
import { lazy, memo, Suspense, useDeferredValue, useState } from 'react';

import { formatFinishReason } from '@/api/chat';
import type { ChatMessage } from '@/api/types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useStreamStore } from '@/stores/stream-store';

const MarkdownContent = lazy(() =>
  import('./MarkdownContent').then((module) => ({ default: module.MarkdownContent })),
);

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
