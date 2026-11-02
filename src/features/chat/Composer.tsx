import { CornerDownLeft, Mic, Send, Square, Paperclip, X, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AttachmentMeta } from '@/api/types';
import { formatBytes, processTextOrImage } from './attachments/validate';

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
  onSendAttachments?: (value: string, attachments: PendingAttachment[]) => void;
  onAttachmentsChange?: (items: PendingAttachment[]) => void;
  externalFiles?: File[];
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
  attachmentNotice?: string;
  apiMode?: boolean;
}

export interface PendingAttachment { meta: AttachmentMeta; blob: Blob; thumb?: Blob; text?: string; processing?: boolean }

function AttachmentThumbnail({ blob }: { blob: Blob }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    if (imageRef.current) imageRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return <img ref={imageRef} alt="" className="h-10 w-10 rounded-lg object-cover" />;
}

const MAX_HEIGHT = 168;

export function Composer({
  disabled = false,
  disabledHint,
  isStreaming,
  value,
  onValueChange,
  onSend,
  onSendAttachments,
  onAttachmentsChange,
  externalFiles,
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
  attachmentNotice = '',
  apiMode = false,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const announce = (items: PendingAttachment[]) => { setAttachments(items); onAttachmentsChange?.(items); };
  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (attachments.length + list.length > 5) { window.dispatchEvent(new CustomEvent('nexa-attachment-error', { detail: 'Você pode anexar até 5 arquivos por mensagem.' })); return; }
    for (const file of list) {
      const temp: PendingAttachment = { meta: { id: `pending-${Date.now()}-${file.name}`, kind: 'text', name: file.name, mime: file.type || 'text/plain', size: file.size, createdAt: new Date().toISOString() }, blob: file, processing: true };
      announce([...attachments, temp]);
      try {
        const result = await processTextOrImage(file);
        const next = [...attachments.filter((item) => item.meta.id !== temp.meta.id), { ...result }];
        announce(next);
      } catch (error) {
        announce(attachments.filter((item) => item.meta.id !== temp.meta.id));
        window.dispatchEvent(new CustomEvent('nexa-attachment-error', { detail: error instanceof Error ? error.message : 'Não foi possível ler o arquivo.' }));
      }
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  useEffect(() => {
    if (!externalFiles?.length) return;
    const timer = window.setTimeout(() => void addFiles(externalFiles), 0);
    return () => window.clearTimeout(timer);
  // The parent only changes this value when a new drop occurs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalFiles]);

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !attachments.some((item) => item.processing) && !disabled && !isStreaming;
  const voiceBlocked = disabled || isStreaming || !voiceEnabled;

  const submit = () => {
    const trimmed = value.trim();

    if ((!trimmed && !attachments.length) || disabled || isStreaming || attachments.some((item) => item.processing)) {
      return;
    }

    if (onSendAttachments) onSendAttachments(trimmed, attachments);
    else onSend(trimmed);
    announce([]);
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
          'nexa-composer mx-auto flex w-full max-w-[760px] flex-wrap items-end gap-2 rounded-2xl border p-2.5 transition',
          disabled ? 'opacity-70' : '',
        )}
      >
        <input ref={inputRef} type="file" multiple accept="image/*,application/pdf,.pdf,.txt,.md,.csv,.tsv,.json,.xml,.yaml,.yml,.log,.html,.css,.js,.ts,.tsx,.py,.java,.go,.rs,.sql,.sh" aria-label="Selecionar arquivos para anexar" tabIndex={-1} className="sr-only" onChange={(event) => { if (event.currentTarget.files) void addFiles(event.currentTarget.files); event.currentTarget.value = ''; }} />
        {attachments.length > 0 && (
          <div className="order-0 flex w-full min-w-0 gap-2 overflow-x-auto py-1" aria-label="Anexos selecionados">
            {attachments.map((item) => (
              <div key={item.meta.id} className="flex min-h-16 min-w-0 max-w-56 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface-2 px-2.5 py-2" aria-label={`Anexo: ${item.meta.name}, ${item.meta.kind}, ${formatBytes(item.meta.size)}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-surface text-primary" aria-hidden="true">
                  {item.processing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" /> : item.meta.kind === 'image' && item.thumb ? <AttachmentThumbnail blob={item.thumb} /> : <FileText className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{item.meta.name}</span>
                  <span className="block truncate text-2xs text-muted">{item.processing ? 'Processando…' : `${item.meta.mime.split('/').at(-1)?.toUpperCase()} · ${formatBytes(item.meta.size)}`}</span>
                </span>
                <IconButton label={`Remover anexo ${item.meta.name}`} onClick={() => announce(attachments.filter((entry) => entry.meta.id !== item.meta.id))} className="h-11 w-11"><X className="h-4 w-4" aria-hidden="true" /></IconButton>
              </div>
            ))}
          </div>
        )}
        <IconButton label="Anexar arquivos" onClick={() => inputRef.current?.click()} disabled={disabled || isStreaming}><Paperclip aria-hidden="true" className="h-4 w-4" /></IconButton>
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
          onPaste={(event) => { const files = Array.from(event.clipboardData.files); if (files.length) { event.preventDefault(); void addFiles(files); } }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled ? (disabledHint ?? 'Selecione uma conversa para começar…') : attachments.length ? 'Escreva o contexto para sua IA…' : 'Pergunte à NEXA…'
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

      <p className="mx-auto mt-1 w-full max-w-[760px] px-1 text-2xs text-muted">Os anexos ficam neste navegador{apiMode ? '; no modo API, texto e imagens são enviados à API e ao provedor de IA' : ''}{attachmentNotice ? ` · ${attachmentNotice}` : ''}</p>
      <div className="mx-auto mt-1.5 flex w-full max-w-[760px] items-center justify-between gap-3 px-1">
        <p className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
          Enter envia · Shift + Enter quebra linha
        </p>
        <p className="text-xs text-muted">
          {value.length > 0 || attachments.length > 0
            ? `${value.length + attachments.reduce((sum, item) => sum + (item.meta.textChars ?? 0), 0)}${maxLength ? `/${maxLength}` : ''} caracteres${attachments.length ? ' (inclui anexos)' : ''}`
            : <span className="hidden sm:inline">Ctrl+K foca o campo</span>}
        </p>
      </div>
    </div>
  );
}
