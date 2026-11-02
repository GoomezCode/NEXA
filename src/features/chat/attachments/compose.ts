import type { AttachmentMeta } from '@/api/types';
import type { AttachmentStore } from './store';

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
}

function fitEscapedText(value: string, budget: number): { value: string; truncated: boolean } {
  let output = '';
  for (const char of value) {
    const escaped = escapeXml(char);
    if (output.length + escaped.length > budget) return { value: output, truncated: true };
    output += escaped;
  }
  return { value: output, truncated: false };
}

/** Divide o texto usando o tamanho já escapado, sem cortar entidades XML ou caracteres Unicode. */
export function splitTextForContext(value: string, maxEscapedChars: number): string[] {
  const chunks: string[] = [];
  let chunk = '';
  let used = 0;
  for (const char of value) {
    const escapedLength = escapeXml(char).length;
    if (chunk && used + escapedLength > maxEscapedChars) {
      chunks.push(chunk);
      chunk = '';
      used = 0;
    }
    chunk += char;
    used += escapedLength;
  }
  if (chunk || !chunks.length) chunks.push(chunk);
  return chunks;
}

export async function composeModelContent(text: string, attachments: AttachmentMeta[], store: AttachmentStore, maxChars = Number.POSITIVE_INFINITY): Promise<string> {
  const blocks: string[] = [];
  let remaining = Math.max(0, maxChars - text.length - (text ? 2 : 0));
  for (const attachment of attachments) {
    if (attachment.kind !== 'text') continue;
    const stored = await store.get(attachment.id);
    if (!stored?.text || remaining <= 0) continue;
    const opening = `<attached_file name="${escapeXml(attachment.name)}" type="${escapeXml(attachment.mime)}">`;
    const closing = '</attached_file>';
    const truncation = '\n[conteúdo do arquivo truncado pelo limite de contexto]';
    const contentBudget = Math.max(0, remaining - opening.length - closing.length);
    if (contentBudget <= 0) continue;
    const full = fitEscapedText(stored.text, contentBudget);
    const fitted = full.truncated && contentBudget > truncation.length
      ? fitEscapedText(stored.text, contentBudget - truncation.length)
      : full;
    const content = `${fitted.value}${fitted.truncated && contentBudget > truncation.length ? truncation : ''}`;
    const block = `${opening}${content}${closing}`;
    blocks.push(block);
    remaining -= block.length + 2;
  }
  return [text, ...blocks].filter(Boolean).join('\n\n');
}
