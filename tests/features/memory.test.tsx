import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearMemoryStorage,
  createMemory,
  listMemories,
  parseMemoryTags,
  resetMemoryCacheForTests,
} from '@/features/memory/api';
import { MemoryView } from '@/features/memory/MemoryView';
import { selectRelevantMemories } from '@/features/chat/personalization';

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryView />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await clearMemoryStorage();
  resetMemoryCacheForTests();
});

afterEach(() => {
  cleanup();
});

describe('MemoryView', () => {
  it('cria uma memória com título, conteúdo e tags', async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('Nenhuma memória ainda.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nova memória' }));
    await user.type(screen.getByLabelText('Nome'), 'Tom de voz');
    await user.type(screen.getByLabelText('Conteúdo'), 'Responder de forma curta e direta.');
    await user.type(screen.getByLabelText('Tags'), 'Preferências, voz');
    await user.click(screen.getByRole('button', { name: 'Salvar memória' }));

    expect(await screen.findByRole('heading', { name: 'Tom de voz' })).toBeInTheDocument();
    expect(screen.getByText('Responder de forma curta e direta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /preferências \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /voz \(1\)/ })).toBeInTheDocument();
  });

  it('busca sem acento e filtra por tag', async () => {
    const user = userEvent.setup();
    await createMemory({
      title: 'Reunião de produto',
      content: 'Decidimos priorizar a memória local.',
      tags: ['trabalho'],
    });
    await createMemory({
      title: 'Preferência de voz',
      content: 'Tom calmo e respostas curtas.',
      tags: ['voz'],
    });

    renderView();
    expect(await screen.findByRole('heading', { name: 'Reunião de produto' })).toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: 'Buscar memórias' });
    await user.type(search, 'reuniao');

    expect(screen.getByRole('heading', { name: 'Reunião de produto' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Preferência de voz' })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'inexistente');
    expect(screen.getByText('Nenhuma memória encontrada.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await user.click(screen.getByRole('button', { name: /voz \(1\)/ }));

    expect(screen.getByRole('heading', { name: 'Preferência de voz' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reunião de produto' })).not.toBeInTheDocument();
  });

  it('edita e esquece uma memória com confirmação', async () => {
    const user = userEvent.setup();
    await createMemory({
      title: 'Configuração',
      content: 'Modelo principal.',
      tags: ['sistema'],
    });

    renderView();
    expect(await screen.findByRole('heading', { name: 'Configuração' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Editar Configuração' }));
    const name = screen.getByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Configuração atualizada');
    await user.click(screen.getByRole('button', { name: 'Salvar memória' }));

    expect(
      await screen.findByRole('heading', { name: 'Configuração atualizada' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Esquecer Configuração atualizada' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Esquecer Configuração atualizada',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Esquecer' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Configuração atualizada' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('Nenhuma memória ainda.')).toBeInTheDocument();
  });

  it('persiste a memória após remontar a partir do IndexedDB', async () => {
    await createMemory({
      title: 'Memória persistente',
      content: 'Sobrevive ao reload.',
      tags: ['teste'],
    });
    resetMemoryCacheForTests();

    renderView();

    expect(await screen.findByRole('heading', { name: 'Memória persistente' })).toBeInTheDocument();
  });

  it('normaliza tags repetidas e vazias', () => {
    expect(parseMemoryTags(' Sistema, sistema, , Preferências,  ')).toEqual([
      'sistema',
      'preferências',
    ]);
  });

  it('permite desligar memórias e exclui as desligadas do contexto', async () => {
    const user = userEvent.setup();
    const memory = await createMemory({ title: 'Projeto', content: 'Usar TypeScript no projeto.', tags: ['código'] });
    renderView();
    const toggle = await screen.findByRole('checkbox', { name: 'Usar memória Projeto nesta IA' });
    await user.click(toggle);
    await waitFor(() => expect(screen.getByText('0 memórias ativas para a IA')).toBeInTheDocument());
    expect(selectRelevantMemories(await listMemories(), 'Como configurar o projeto?')).toEqual([]);
    expect(memory.enabled).toBe(true);
  });
});
