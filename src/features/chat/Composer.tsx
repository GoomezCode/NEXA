import { CornerDownLeft, Mic, Send, Square } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/Button';

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
    <div className="nexa-composer-shell shrink-0 px-3 pb-3 pt-3 sm:px-5">
      {voiceEnabled && (listening || interim || voiceError) && (
        <div
          role={voiceError ? 'alert' : 'status'}
          aria-live="polite"
          className={cn(
            'mx-auto mb-2 w-full max-w-3xl rounded-xl border px-3 py-2 text-2xs leading-relaxed',
            voiceError
              ? 'border-danger/25 bg-danger/5 text-danger'
              : 'border-primary/25 bg-primary/5 text-primary',
          )}
        >
          <span className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.14em]">
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
          'nexa-composer mx-auto flex w-full max-w-[760px] items-end gap-2 rounded-2xl border p-2.5 transition',
          disabled ? 'opacity-70' : '',
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
          className="nexa-field max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2 text-base leading-relaxed text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed"
        />

        {voiceEnabled && (
          <IconButton
            label={!voiceSupported
              ? 'Entrada por voz indisponível neste navegador'
              : listening
                ? 'Encerrar entrada por voz'
                : 'Entrada por voz: segure para falar'}
            onPointerDown={(event) => {
              if (event.button !== 0 || voiceBlocked) {
                return;
              }

              event.preventDefault();
              if (event.pointerType === 'touch') {
                if (listening) onVoiceStop();
                else onVoiceStart();
                return;
              }
              onVoiceStart();
            }}
            onPointerUp={(event) => {
              if (voiceBlocked || event.pointerType === 'touch') {
                return;
              }

              event.preventDefault();
              onVoiceStop();
            }}
            onPointerLeave={(event) => {
              if (event.pointerType !== 'touch' && listening) {
                onVoiceStop();
              }
            }}
            onPointerCancel={onVoiceCancel}
            onContextMenu={(event) => event.preventDefault()}
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
            title={
              !voiceSupported
                ? 'Reconhecimento de voz indisponível neste navegador'
                : voiceBlocked
                  ? 'Aguarde a resposta terminar'
                  : 'Segure para falar'
            }
            className={cn(
              'flex h-11 w-11 shrink-0 touch-none select-none items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40',
              listening
                ? 'border-danger/40 bg-danger/15 text-danger'
                : 'border-border bg-surface-2 text-muted hover:border-primary/35 hover:text-primary',
            )}
          >
            <Mic className={cn('h-4 w-4', listening && 'animate-pulse')} aria-hidden="true" />
          </IconButton>
        )}

        {isStreaming ? (
          <IconButton
            label="Parar resposta"
            onClick={onStop}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-danger/35 bg-danger/10 text-danger transition hover:bg-danger/15"
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
          </IconButton>
        ) : (
          <IconButton
            label="Enviar mensagem"
            onClick={submit}
            disabled={!canSend}
            className={cn('nexa-send-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed', canSend && 'is-ready')}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        )}
      </div>

      <div className="mx-auto mt-1.5 flex w-full max-w-[760px] items-center justify-between gap-3 px-1">
        <p className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
          Enter envia · Shift + Enter quebra linha
        </p>
        <p className="text-xs text-muted">
          {value.length > 0
            ? `${value.length}${maxLength ? `/${maxLength}` : ''} caracteres`
            : <span className="hidden sm:inline">Ctrl+K foca o campo</span>}
        </p>
      </div>
    </div>
  );
}
