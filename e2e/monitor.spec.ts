import { expect, test } from '@playwright/test';

test('abre o Monitor e explica a telemetria desligada no modo demo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Monitor' })
    .click();

  await expect(page.getByRole('heading', { name: 'Monitor' })).toBeVisible();
  await expect(page.getByText(/telemetria da API fica desligada/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atualizar telemetria' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'API' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SESSÃO' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'COTA DIÁRIA' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'MODELOS E PROVEDORES' })).toBeVisible();
  await expect(page.getByText('Catálogo indisponível no modo demonstração.')).toBeVisible();
});

test('seleciona um modelo do catálogo e mantém a escolha após recarregar', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('nexa:settings:v1', JSON.stringify({ demoMode: false, apiUrl: '/api/v1' }));
  });

  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      json: {
        access_token: 't',
        token_type: 'bearer',
        expires_in: 3600,
        role: 'user',
        user_id: 'u1',
      },
    }),
  );
  await page.route('**/health', (route) =>
    route.fulfill({ json: { status: 'ok', version: '2.1.0' } }),
  );
  await page.route('**/api/v1/usage', (route) =>
    route.fulfill({
      json: {
        daily_limit: 10,
        daily_remaining: 7,
        per_minute_limit: 3,
        per_minute_remaining: 2,
        resets_at: null,
      },
    }),
  );
  await page.route('**/api/v1/models*', (route) =>
    route.fulfill({
      json: {
        default_model: 'nexa/mini',
        providers: ['nexa'],
        models: [{ model_id: 'nexa/mini', name: 'Nexa Mini', provider: 'nexa' }],
      },
    }),
  );

  const openMonitor = async () => {
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('button', { name: 'Monitor' })
      .click();
  };

  await page.goto('/');
  await page.getByLabel('Usuário').fill('teste01');
  await page.getByLabel('Senha', { exact: true }).fill('segredo123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();
  await expect(page.getByRole('textbox', { name: 'Mensagem para a NEXA' })).toBeVisible();

  await openMonitor();

  const option = page.getByRole('button', { name: 'Usar modelo Nexa Mini' });
  await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Mensagem para a NEXA' })).toBeVisible();
  await openMonitor();

  await expect(page.getByRole('button', { name: 'Usar modelo Nexa Mini' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
