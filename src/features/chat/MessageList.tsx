import { ArrowDown, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { ChatMessage } from '@/api/types';
import { NexaMark } from '@/components/brand/NexaMark';

import { MessageBubble } from './MessageBubble';

const SUGGESTIONS = ['Status do sistema', 'Quem é você?', 'Como funciona a NEXA?'] as const;

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  /** Bloqueia ações que disparam envio (sugestões e retry da última troca). */
  disabled?: boolean;
  onRetry: () => void;
  onRetryLast: () => void;
  onSuggestion: (value: string) => void;
}

export function MessageList({
  messages,
  isLoading,
  isError,
  error,
  disabled = false,
  onRetry,
  onRetryLast,
  onSuggestion,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showJumpButton, setShowJumpButton] = useState(false);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !stickToBottom.current) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    setShowJumpButton(false);
  }, [messages]);

  if (isLoading) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6"
        aria-busy="true"
      >
        <span className="sr-only" role="status">
          Carregando mensagens
        </span>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-16 animate-pulse rounded-2xl border border-white/5 bg-surface/40"
            style={{ width: row === 1 ? '68%' : '82%', marginLeft: row === 1 ? 'auto' : undefined }}
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl border border-danger/25 bg-danger/5 p-5 text-center">
          <p className="text-sm font-semibold text-danger">Conexão interrompida</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Não foi possível carregar esta conversa.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-danger transition hover:bg-danger/15"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-5 sm:p-8">
        <div className="w-full max-w-lg text-center">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <div className="nexa-pulse absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
            <div className="nexa-spin-slow absolute inset-0 rounded-full border border-dashed border-primary/20" />
            <NexaMark size={52} className="relative" />
          </div>

          <p className="mt-4 font-mono text-2xs uppercase tracking-[0.3em] text-primary/70">
            canal aberto
          </p>
          <h3 className="mt-2 font-display text-lg tracking-[0.12em] text-foreground">
            Como posso ajudar?
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Envie uma mensagem ou comece por um dos comandos abaixo.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestion(suggestion)}
                disabled={disabled}
                title={disabled ? 'Sem conexão — aguardando a rede…' : undefined}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-surface/70 px-3.5 py-2 text-xs text-muted transition hover:border-primary/35 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        onScroll={() => {
          const container = containerRef.current;
          if (!container) return;
          stickToBottom.current = container.scrollHeight - container.scrollTop - container.clientHeight < 96;
          setShowJumpButton(!stickToBottom.current);
        }}
        className="h-full overflow-y-auto"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 sm:px-6">
          {messages.map((message) => (
            <div key={message.id} className="nexa-message-row">
              <MessageBubble message={message} />
            </div>
          ))}

          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/25 bg-danger/5 px-3 py-2"
            >
              <p className="text-xs text-danger">{error}</p>
              <button
                type="button"
                onClick={onRetryLast}
                disabled={disabled}
                title={disabled ? 'Sem conexão — aguardando a rede…' : undefined}
                className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 font-mono text-2xs uppercase tracking-[0.12em] text-danger transition hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      </div>
      {showJumpButton && (
        <button
          type="button"
          onClick={() => {
            stickToBottom.current = true;
            const container = containerRef.current;
            if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            setShowJumpButton(false);
          }}
          className="absolute bottom-3 right-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-surface px-4 font-mono text-xs text-primary shadow-xl active:scale-95"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
          Ir para o fim
        </button>
      )}
    </div>
  );
}
