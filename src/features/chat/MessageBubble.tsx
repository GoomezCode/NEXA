import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { formatFinishReason } from '@/api/chat';
import type { ChatMessage } from '@/api/types';
import { NexaMark } from '@/components/brand/NexaMark';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_NOTE: Partial<Record<ChatMessage['status'], string>> = {
  stopped: 'Resposta interrompida',
  error: 'Falha ao gerar a resposta',
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const note = STATUS_NOTE[message.status];

  return (
    <article
      className={cn('flex w-full gap-2.5 sm:gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
      aria-label={isUser ? 'Sua mensagem' : 'Mensagem da NEXA'}
    >
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
          isUser
            ? 'border-white/10 bg-white/5 font-mono text-2xs text-muted'
            : 'border-primary/25 bg-primary/10',
        )}
        aria-hidden="true"
      >
        {isUser ? 'VC' : <NexaMark size={16} />}
      </div>

      <div
        className={cn(
          'flex min-w-0 max-w-[86%] flex-col sm:max-w-[78%]',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'inline-block rounded-2xl border px-3.5 py-2.5 text-left',
            isUser
              ? 'border-white/10 bg-surface-2/80 text-foreground'
              : 'border-primary/15 bg-surface/80 text-foreground',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="nexa-markdown text-sm leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={{
                table: ({ children }) => <div className="nexa-markdown-table"><table>{children}</table></div>,
              }}>
                {message.content}
              </ReactMarkdown>
              {isStreaming && <span className="nexa-caret" aria-hidden="true" />}
            </div>
          )}
        </div>

        <div
          className={cn(
            'mt-1 flex flex-wrap items-center gap-2 px-1 font-mono text-2xs uppercase tracking-[0.12em] text-muted/60',
            isUser && 'justify-end',
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isStreaming && <span className="text-primary/80">transmitindo</span>}
          {note && (
            <span className={message.status === 'error' ? 'text-danger/80' : 'text-warning/80'}>
              {note}
            </span>
          )}
          {!isUser && message.status === 'done' && message.finish_reason && (
            <span className="text-primary/80">
              {formatFinishReason(message.finish_reason)}
            </span>
          )}
          {!isUser && message.status === 'done' && message.finish_reason === 'stop' && (
            <span className="text-muted/60">NEXA</span>
          )}
        </div>
      </div>
    </article>
  );
}
