import type { ChatMessage } from '@/api/types';

export interface ContextLimits {
  maxMessages: number;
  maxChars: number;
}

export const limitsFor = (role: string): ContextLimits =>
  role === 'admin' ? { maxMessages: 100, maxChars: 8000 } : { maxMessages: 20, maxChars: 2000 };

export class ContextTooLargeError extends Error {
  constructor(public readonly maxChars: number) {
    super(`A mensagem passa de ${maxChars} caracteres.`);
    this.name = 'ContextTooLargeError';
  }
}

export function fitContextToBudget(history: ChatMessage[], { budgetChars }: { budgetChars: number }): { role: 'user' | 'assistant'; content: string }[] {
  const merged: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const message of history) {
    const text = message.content.trim();
    if ((message.role !== 'user' && message.role !== 'assistant') || message.status === 'error' || message.status === 'streaming' || !text) continue;
    const last = merged.at(-1);
    if (last?.role === message.role) last.content += `\n\n${text}`;
    else merged.push({ role: message.role, content: text });
  }
  const last = merged.at(-1);
  if (!last || last.role !== 'user') throw new Error('A última mensagem precisa ser do usuário.');
  if (last.content.length > budgetChars) throw new ContextTooLargeError(budgetChars);
  let total = merged.reduce((sum, message) => sum + message.content.length, 0);
  while (merged.length > 1 && total > budgetChars) total -= merged.shift()!.content.length;
  if (merged.length > 1 && merged[0]!.role === 'assistant') merged.shift();
  return merged;
}

/**
 * Converte o histórico local em uma lista de mensagens aceita pela API:
 * descarta rascunhos/falhas, agrupa papéis repetidos, trunca antigas e
 * mantém a última mensagem do usuário intacta.
 */
export function fitContext(
  history: ChatMessage[],
  { maxMessages, maxChars }: ContextLimits,
): { role: 'user' | 'assistant'; content: string }[] {
  const merged: { role: 'user' | 'assistant'; content: string }[] = [];

  for (const message of history) {
    const text = message.content.trim();
    const valid =
      (message.role === 'user' || message.role === 'assistant') &&
      message.status !== 'error' &&
      message.status !== 'streaming' &&
      Boolean(text);

    if (!valid) continue;

    const last = merged.at(-1);
    if (last?.role === message.role) last.content += `\n\n${text}`;
    else merged.push({ role: message.role as 'user' | 'assistant', content: text });
  }

  const last = merged.at(-1);
  if (!last || last.role !== 'user') throw new Error('A última mensagem precisa ser do usuário.');
  if (last.content.length > maxChars) throw new ContextTooLargeError(maxChars);

  let result = merged
    .map((message, index) =>
      index === merged.length - 1 || message.content.length <= maxChars
        ? message
        : { ...message, content: `${message.content.slice(0, maxChars - 1)}…` },
    )
    .slice(-maxMessages);

  while (result.length > 1 && result[0]!.role === 'assistant') result = result.slice(1);
  return result;
}
