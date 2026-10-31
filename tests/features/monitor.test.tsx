import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MonitorView } from '@/features/monitor/MonitorView';
import { resetAuthForTests, useAuthStore } from '@/stores/auth-store';
import { useModelStore } from '@/stores/model-store';
import { DEFAULT_SETTINGS, resetSettingsForTests, useSettingsStore } from '@/stores/settings-store';

function renderMonitor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MonitorView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetSettingsForTests();
  resetAuthForTests();
  useModelStore.getState().reset();
  useAuthStore.getState().setSession({
    token: 't',
    role: 'user',
    userId: 'u1',
    username: 'ana',
    expiresAt: Date.now() + 3_600_000,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetSettingsForTests();
  resetAuthForTests();
  useModelStore.getState().reset();
});

describe('MonitorView', () => {
  it('avisa que a telemetria está desligada no modo demonstração', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, demoMode: true } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderMonitor();

    expect(
      await screen.findByText(/Modo demonstração ativo: as respostas são geradas localmente/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mostra saúde e cotas vindas da API', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, demoMode: false } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith('/health')) {
          return new Response(JSON.stringify({ status: 'ok', version: '2.1.0' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.endsWith('/models')) {
          return new Response(
            JSON.stringify({
              default_model: 'nexa/mini',
              providers: ['nexa', 'openai'],
              models: [
                {
                  model_id: 'nexa/mini',
                  name: 'Nexa Mini',
                  provider: 'nexa',
                  context_window: 32000,
                  capabilities: { chat: true, tools: true, vision: false, json: true },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            daily_limit: 10,
            daily_remaining: 7,
            per_minute_limit: 3,
            per_minute_remaining: 2,
            resets_at: '2026-10-31T00:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    renderMonitor();

    expect(await screen.findByText('online')).toBeInTheDocument();
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'mensagens restantes: 7 de 10 disponíveis' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'mensagens restantes: 2 de 3 disponíveis' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ana')).toBeInTheDocument();

    expect(await screen.findByText('Nexa Mini')).toBeInTheDocument();
    expect(screen.getAllByText('nexa/mini').length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: 'Provedores' })).toHaveTextContent(/nexa.*openai/i);
    expect(screen.getByText('32.000 tokens')).toBeInTheDocument();

    const user = userEvent.setup();
    const option = screen.getByRole('button', { name: 'Usar modelo Nexa Mini' });
    expect(option).toHaveAttribute('aria-pressed', 'false');

    await user.click(option);

    expect(useModelStore.getState().selectedModelId).toBe('nexa/mini');
    expect(window.localStorage.getItem('nexa:model:v1')).toBe('nexa/mini');
    expect(option).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Usar seleção automática' }));

    expect(useModelStore.getState().selectedModelId).toBeNull();
    expect(window.localStorage.getItem('nexa:model:v1')).toBeNull();
  });

  it('aceita o formato real de /models com provedores como objetos', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, demoMode: false } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const json = (body: unknown) =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });

        if (url.endsWith('/health')) return json({ status: 'ok' });

        if (url.endsWith('/models')) {
          return json({
            default_model: 'nexa/mini',
            providers: [
              {
                provider: 'nexa',
                name: 'NEXA Local',
                available: true,
                default_model: 'nexa/mini',
                models: [{ model_id: 'nexa/mini' }],
              },
              {
                provider: 'openai',
                name: 'OpenAI',
                available: false,
                default_model: 'openai/gpt',
                models: [],
              },
            ],
            models: [
              {
                model_id: 'nexa/mini',
                provider: 'nexa',
                name: 'Nexa Mini',
                selectable: true,
              },
            ],
          });
        }

        return json({
          daily_limit: 10,
          daily_remaining: 7,
          per_minute_limit: 3,
          per_minute_remaining: 2,
          resets_at: null,
        });
      }),
    );

    renderMonitor();

    expect(await screen.findByText('NEXA Local')).toBeInTheDocument();
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: 'Provedores' })).toHaveTextContent(
      /openai.*indisponível/i,
    );
    expect(screen.getByText('Nexa Mini')).toBeInTheDocument();
  });

  it('mostra o erro real quando a API não responde', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, demoMode: false } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    renderMonitor();

    expect(await screen.findByText('offline')).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/Não foi possível falar com a API/)).length,
    ).toBeGreaterThan(0);
  });
});
