import { beforeEach, describe, expect, it } from 'vitest';

import { useStreamStore } from '@/stores/stream-store';

describe('stream-store', () => {
  beforeEach(() => useStreamStore.setState({ messageId: null, content: '' }));

  it('agrega partes sem alterar o identificador da bolha ativa', () => {
    const { begin, append } = useStreamStore.getState();
    begin('assistant-1');
    append('assistant-1', 'Olá ');
    append('assistant-1', 'mundo');

    expect(useStreamStore.getState()).toMatchObject({
      messageId: 'assistant-1',
      content: 'Olá mundo',
    });
  });

  it('ignora partes e limpeza de uma resposta que não está ativa', () => {
    const { begin, append, clear } = useStreamStore.getState();
    begin('assistant-1');
    append('assistant-2', 'fora de ordem');
    clear('assistant-2');

    expect(useStreamStore.getState()).toMatchObject({
      messageId: 'assistant-1',
      content: '',
    });
  });
});
