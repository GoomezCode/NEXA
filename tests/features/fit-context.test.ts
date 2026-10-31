import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '@/api/types';
import { ContextTooLargeError, fitContext, limitsFor } from '@/features/chat/context';

function message(
  role: ChatMessage['role'],
  content: string,
  status: ChatMessage['status'] = 'done',
): ChatMessage {
  return {
    id: `${role}-${content.slice(0, 4)}-${Math.random()}`,
    role,
    content,
    createdAt: '2026-10-30T10:00:00.000Z',
    status,
  };
}

describe('fitContext', () => {
  it('ignora mensagens com erro, streaming ou vazias', () => {
    const result = fitContext(
      [
        message('user', 'primeira'),
        message('assistant', 'rascunho', 'streaming'),
        message('assistant', 'falha', 'error'),
        message('assistant', '   '),
        message('user', 'segunda'),
      ],
      limitsFor('guest'),
    );

    expect(result).toEqual([{ role: 'user', content: 'primeira\n\nsegunda' }]);
  });

  it('colapsa papéis repetidos', () => {
    const result = fitContext(
      [message('user', 'a'), message('user', 'b'), message('assistant', 'c'), message('user', 'd')],
      limitsFor('admin'),
    );

    expect(result).toEqual([
      { role: 'user', content: 'a\n\nb' },
      { role: 'assistant', content: 'c' },
      { role: 'user', content: 'd' },
    ]);
  });

  it('trunca mensagens antigas e mantém a última intacta', () => {
    const long = 'x'.repeat(50);
    const result = fitContext(
      [message('user', long), message('assistant', 'ok'), message('user', 'final')],
      { maxMessages: 10, maxChars: 10 },
    );

    expect(result[0]).toEqual({ role: 'user', content: `${'x'.repeat(9)}…` });
    expect(result.at(-1)).toEqual({ role: 'user', content: 'final' });
  });

  it('descarta as mensagens mais antigas pelo limite de quantidade', () => {
    const history = Array.from({ length: 6 }, (_, index) =>
      message(index % 2 === 0 ? 'user' : 'assistant', `m${index}`),
    );
    history.push(message('user', 'última'));

    const result = fitContext(history, { maxMessages: 3, maxChars: 100 });

    expect(result).toHaveLength(3);
    expect(result.at(-1)).toEqual({ role: 'user', content: 'última' });
  });

  it('recusa última mensagem que não seja do usuário', () => {
    expect(() => fitContext([message('assistant', 'oi')], limitsFor('guest'))).toThrow(
      /última mensagem/i,
    );
  });

  it('recusa mensagem atual acima do limite', () => {
    expect(() =>
      fitContext([message('user', 'x'.repeat(20))], { maxMessages: 20, maxChars: 10 }),
    ).toThrow(ContextTooLargeError);
  });
});
