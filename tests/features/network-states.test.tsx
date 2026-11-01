import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetChatAdapterForTests } from '@/api';
import { SessionsSidebar } from '@/features/chat/SessionsSidebar';
import { MessageList } from '@/features/chat/MessageList';
import { DEFAULT_SETTINGS, resetSettingsForTests, useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';

function renderWithClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(<MemoryRouter><QueryClientProvider client={client}>{node}</QueryClientProvider></MemoryRouter>);
}

beforeEach(() => {
  resetChatAdapterForTests();
  resetSettingsForTests();
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, demoMode: false } });
  useUiStore.setState({ aiState: 'idle' });
});

afterEach(() => {
  cleanup();
  resetSettingsForTests();
  resetChatAdapterForTests();
  vi.unstubAllGlobals();
});

describe('estados de rede', () => {
  it('lista as conversas locais sem depender da API', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Falha de rede'));
    vi.stubGlobal('fetch', fetchMock);

    renderWithClient(<SessionsSidebar />);

    expect((await screen.findAllByRole('button', { name: /Boas-vindas/ })).length).toBeGreaterThan(
      0,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mostra o erro de carregamento de mensagens com ação de retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <MessageList
        messages={[]}
        isLoading={false}
        isError
        error={null}
        onRetry={onRetry}
        onRetryLast={() => undefined}
        onSuggestion={() => undefined}
      />,
    );

    expect(screen.getByText('Conexão interrompida')).toBeInTheDocument();
    expect(screen.getByText('Não foi possível carregar esta conversa.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
