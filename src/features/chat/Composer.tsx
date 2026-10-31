import { CornerDownLeft, Mic, Send, Square } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

interface ComposerProps {
  disabled?: boolean;
  /** Texto do placeholder quando o envio está bloqueado por outro motivo. */
  disabledHint?: string;
  isStreaming: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onSend: (value: string) => void;
  onStop: () => void;
  voiceEnabled: boolean;
  voiceSupported: boolean;
  listening: boolean;
  interim: string;
  voiceError: string | null;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  onVoiceCancel: () => void;
  /** Limite de caracteres da mensagem para o papel atual. */
  maxLength?: number;
}

const MAX_HEIGHT = 168;

export function Composer({
  disabled = false,
  disabledHint,
  isStreaming,
  value,
  onValueChange,
  onSend,
  onStop,
  voiceEnabled,
  voiceSupported,
  listening,
  interim,
  voiceError,
  onVoiceStart,
  onVoiceStop,
  onVoiceCancel,
  maxLength,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !disabled && !isStreaming;
  const voiceBlocked = disabled || isStreaming || !voiceEnabled;

  const submit = () => {
    const trimmed = value.trim();

    if (!trimmed || disabled || isStreaming) {
      return;
    }

    onSend(trimmed);
    textareaRef.current?.focus();
  };

  return (
    <div className="shrink-0 border-t border-white/5 bg-background/50 px-3 py-3 pb-[max(0.75rem,var(--safe-bottom),var(--kb-inset))] sm:px-5">
      {voiceEnabled && (listening || interim || voiceError) && (
        <div
          role={voiceError ? 'alert' : 'status'}
          aria-live="polite"
          className={cn(
            'mx-auto mb-2 w-full max-w-3xl rounded-xl border px-3 py-2 text-[11px] leading-relaxed',
            voiceError
              ? 'border-danger/25 bg-danger/5 text-danger'
              : 'border-primary/25 bg-primary/5 text-primary',
          )}
        >
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]">
            <Mic className="h-3 w-3 shrink-0" aria-hidden="true" />
            {listening ? 'Ouvindo · solte para encerrar' : 'Transcrição de voz'}
          </span>
          <p className={cn('mt-1', voiceError ? 'text-danger' : 'text-foreground/85')}>
            {voiceError ?? (interim || 'Fale agora…')}
          </p>
        </div>
      )}

      <div
        className={cn(
          'mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border bg-surface/70 p-2 transition',
          disabled ? 'border-white/5 opacity-60' : 'border-white/10 focus-within:border-primary/40',
        )}
      >
        <label htmlFor="nexa-composer" className="sr-only">
          Mensagem para a NEXA
        </label>
        <textarea
          id="nexa-composer"
          ref={textareaRef}
          rows={1}
          enterKeyHint="send"
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled ? (disabledHint ?? 'Selecione uma conversa para começar…') : 'Pergunte à NEXA…'
          }
          aria-label="Mensagem para a NEXA"
          aria-keyshortcuts="Control+K Meta+K"
          className="nexa-field max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base leading-relaxed text-foreground outline-none placeholder:text-muted/70 disabled:cursor-not-allowed sm:text-sm"
        />

        {voiceEnabled && (
          <button
            type="button"
            onPointerDown={(event) => {
              if (event.button !== 0 || voiceBlocked) {
                return;
              }

              event.preventDefault();
              onVoiceStart();
            }}
            onPointerUp={(event) => {
              if (voiceBlocked) {
                return;
              }

              event.preventDefault();
              onVoiceStop();
            }}
            onPointerLeave={() => {
              if (listening) {
                onVoiceStop();
              }
            }}
            onPointerCancel={onVoiceCancel}
            onKeyDown={(event) => {
              if ((event.key === ' ' || event.key === 'Enter') && !voiceBlocked && !listening) {
                event.preventDefault();
                onVoiceStart();
              }
            }}
            onKeyUp={(event) => {
              if ((event.key === ' ' || event.key === 'Enter') && listening) {
                event.preventDefault();
                onVoiceStop();
              }
            }}
            disabled={voiceBlocked}
            aria-pressed={listening}
            aria-label={
              !voiceSupported
                ? 'Entrada por voz indisponível neste navegador'
                : listening
                  ? 'Encerrar entrada por voz'
                  : 'Entrada por voz: segure para falar'
            }
            title={
              !voiceSupported
                ? 'Reconhecimento de voz indisponível neste navegador'
                : voiceBlocked
                  ? 'Aguarde a resposta terminar'
                  : 'Segure para falar'
            }
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40',
              listening
                ? 'border-danger/40 bg-danger/15 text-danger'
                : 'border-white/10 bg-white/5 text-muted hover:border-primary/35 hover:text-primary',
            )}
          >
            <Mic className={cn('h-4 w-4', listening && 'animate-pulse')} aria-hidden="true" />
          </button>
        )}

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Parar resposta"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-danger/35 bg-danger/10 text-danger transition hover:bg-danger/15"
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Enviar mensagem"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary transition hover:bg-primary/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-muted/60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mx-auto mt-2 flex w-full max-w-3xl items-center justify-between gap-3 px-1">
        <p className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70 sm:flex">
          <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
          Enter envia · Shift + Enter quebra linha
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70">
          {value.length > 0
            ? `${value.length}${maxLength ? `/${maxLength}` : ''} caracteres`
            : <span className="hidden sm:inline">Ctrl+K foca o campo</span>}
        </p>
      </div>
    </div>
  );
}
