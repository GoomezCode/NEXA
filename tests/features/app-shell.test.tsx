import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetChatAdapterForTests } from '@/api';
import { clearPersistedChat } from '@/api/storage/indexed-db';
import { App } from '@/app/App';
import { queryClient } from '@/app/query-client';
import { clearMemoryStorage, resetMemoryCacheForTests } from '@/features/memory/api';
import { resetNotificationsForTests } from '@/stores/notification-store';
import { DEFAULT_SETTINGS, resetSettingsForTests, useSettingsStore } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';

beforeEach(async () => {
  cleanup();
  resetChatAdapterForTests();
  await clearPersistedChat();
  await clearMemoryStorage();
  resetMemoryCacheForTests();
  queryClient.clear();
  resetSettingsForTests();
  // Estes cenários exercitam o HUD no modo demonstração, independente do .env local.
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, demoMode: true } });
  resetNotificationsForTests();
  window.history.replaceState(null, '', '/');
  useUiStore.setState({
    aiState: 'idle',
    sidebarOpen: true,
  });
});

describe('AppShell', () => {
  it('carrega a marca, a conversa inicial e o composer', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'NEXA' })).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Boas-vindas' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mensagem para a NEXA' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });

  it('envia uma mensagem e exibe a resposta em streaming', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Boas-vindas' });
    await screen.findByText(/NEXA online/);

    const textbox = screen.getByRole('textbox', { name: 'Mensagem para a NEXA' });
    await user.type(textbox, 'status do sistema');
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    await waitFor(
      () => {
        expect(screen.getByText(/Núcleo NEXA operacional/)).toBeInTheDocument();
      },
      { timeout: 8000 },
    );

    expect(screen.getByText('status do sistema')).toBeInTheDocument();
  }, 15000);

  it('cria uma nova conversa a partir da barra lateral', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Boas-vindas' });
    await user.click(screen.getByRole('button', { name: 'Criar nova conversa' }));

    expect(await screen.findByRole('heading', { name: 'Nova conversa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Como posso ajudar?' })).toBeInTheDocument();
  });

  it('abre a memória local', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Boas-vindas' });

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    await user.click(within(nav).getByRole('button', { name: 'Memória' }));

    expect(await screen.findByRole('heading', { name: 'Memória' })).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma memória ainda.')).toBeInTheDocument();
  });

  it('foca o composer com Ctrl+K', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Boas-vindas' });

    const textbox = screen.getByRole('textbox', { name: 'Mensagem para a NEXA' });
    expect(textbox).not.toHaveFocus();

    await user.keyboard('{Control>}k{/Control}');

    expect(textbox).toHaveFocus();
  });

  it('renomeia uma conversa e mantém o novo título após recarregar', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Boas-vindas' });
    await user.click(screen.getByRole('button', { name: 'Renomear Boas-vindas' }));

    const input = screen.getByRole('textbox', { name: 'Novo título da conversa' });
    await user.clear(input);
    await user.type(input, 'Plano de lançamento');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('heading', { name: 'Plano de lançamento' })).toBeInTheDocument();

    cleanup();
    resetChatAdapterForTests();
    queryClient.clear();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Plano de lançamento' })).toBeInTheDocument();
    expect(screen.queryByText('Boas-vindas')).not.toBeInTheDocument();
  }, 15000);

  it('filtra conversas pela busca', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Boas-vindas' });
    await user.click(screen.getByRole('button', { name: 'Criar nova conversa' }));
    await screen.findByRole('heading', { name: 'Nova conversa' });

    const search = screen.getByRole('searchbox', { name: 'Buscar conversas' });
    await user.type(search, 'plano inexistente');

    expect(screen.getByText('Nenhuma conversa encontrada.')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Boas-vindas/ })).toHaveLength(0);

    await user.click(screen.getAllByRole('button', { name: 'Limpar busca' })[0]!);

    expect((await screen.findAllByRole('button', { name: /Boas-vindas/ })).length).toBeGreaterThan(
      0,
    );
  }, 15000);

  it('exclui uma conversa somente após confirmação', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Boas-vindas' });
    await user.click(screen.getByRole('button', { name: 'Excluir Boas-vindas' }));

    const dialog = screen.getByRole('alertdialog', { name: /Excluir.*Boas-vindas/ });
    expect(within(dialog).getByText(/não pode ser desfeita/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Boas-vindas' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir Boas-vindas' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: /Excluir.*Boas-vindas/ })).getByRole('button', {
        name: 'Excluir',
      }),
    );

    expect((await screen.findAllByText(/Nenhuma conversa ainda/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Boas-vindas' })).not.toBeInTheDocument();
  });

  it('salva o nome de exibição nos ajustes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Boas-vindas' });
    await user.click(screen.getByRole('button', { name: 'Abrir ajustes' }));

    const nameInput = await screen.findByRole('textbox', {
      name: 'Como a NEXA deve chamar você',
    });
    await user.clear(nameInput);
    await user.type(nameInput, 'Marina');
    expect(nameInput).toHaveValue('Marina');
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));

    cleanup();
    const secondUser = userEvent.setup();
    render(<App />);
    await secondUser.click(await screen.findByRole('button', { name: 'Abrir ajustes' }));

    expect(
      await screen.findByRole('textbox', { name: 'Como a NEXA deve chamar você' }),
    ).toHaveValue('Marina');
  });

  it('mostra o aviso do modo demonstração', async () => {
    render(<App />);

    expect(await screen.findByRole('status', { name: 'Aviso de demonstração' })).toHaveTextContent(
      /respostas simuladas localmente/i,
    );
  });
});
