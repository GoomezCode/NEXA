import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetChatAdapterForTests } from '@/api';
import { ChatView } from '@/features/chat/ChatView';
import { DEFAULT_SETTINGS, resetSettingsForTests, useSettingsStore } from '@/stores/settings-store';
import { resetNotificationsForTests } from '@/stores/notification-store';
import { useUiStore } from '@/stores/ui-store';

vi.mock('@/hooks/use-online-status', () => ({
  useOnlineStatus: () => false,
}));

function renderChat() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ChatView sessionId={null} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetChatAdapterForTests();
  resetNotificationsForTests();
  resetSettingsForTests();
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, demoMode: false },
  });
  useUiStore.setState({ aiState: 'idle' });
});

afterEach(() => {
  cleanup();
  resetSettingsForTests();
  resetChatAdapterForTests();
  vi.unstubAllGlobals();
});

describe('ChatView sem conexão', () => {
  it('pausa o envio e explica o motivo quando a API real está offline', () => {
    renderChat();

    expect(screen.getByText(/Sem conexão · envio pausado até a rede voltar/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Sem conexão — aguardando a rede…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tentar agora' })).toBeInTheDocument();
  });

  it('mantém o envio no modo demonstração, que funciona localmente', () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, demoMode: true },
    });

    renderChat();

    expect(
      screen.getByText(/Sem conexão · o modo demonstração continua local/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar agora' })).not.toBeInTheDocument();
  });

  it('não envia sugestões enquanto a API real está offline', async () => {
    const user = userEvent.setup();
    const session = {
      id: 'sess-offline',
      title: 'Conversa offline',
      createdAt: '2026-10-28T10:00:00.000Z',
      updatedAt: '2026-10-28T10:00:00.000Z',
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      if (init?.method === 'POST') {
        return json({});
      }

      return String(input).endsWith('/messages') ? json([]) : json([session]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ChatView sessionId={session.id} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Como posso ajudar?' })).toBeInTheDocument();

    const suggestion = screen.getByRole('button', { name: 'Status do sistema' });
    expect(suggestion).toBeDisabled();

    await user.click(suggestion);

    const posted = fetchMock.mock.calls.some(([, init]) => init?.method === 'POST');
    expect(posted).toBe(false);
  });
});
