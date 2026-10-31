import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('nexa:settings:v1', JSON.stringify({ demoMode: false, apiUrl: '/api/v1' }));
  });
});

test('login libera o HUD', async ({ page }) => {
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

  await page.goto('/');

  await page.getByLabel('Usuário').fill('teste01');
  await page.getByLabel('Senha', { exact: true }).fill('segredo123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();

  await expect(page.getByRole('textbox', { name: 'Mensagem para a NEXA' })).toBeVisible();
  await expect(page.getByText('convidado')).toBeHidden();
});

test('credencial inválida mostra a mensagem genérica', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 401,
      json: { code: 'invalid_credentials', title: 'Credenciais inválidas' },
    }),
  );

  await page.goto('/');

  await page.getByLabel('Usuário').fill('teste01');
  await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();

  await expect(page.getByRole('alert')).toHaveText('Usuário ou senha inválidos.');
  await expect(page.getByRole('textbox', { name: 'Mensagem para a NEXA' })).toBeHidden();
});

test('continuar como convidado libera o HUD', async ({ page }) => {
  await page.route('**/api/v1/auth/guest', (route) =>
    route.fulfill({
      json: {
        access_token: 'g',
        token_type: 'bearer',
        expires_in: 3600,
        role: 'guest',
        user_id: null,
      },
    }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar como convidado' }).click();

  await expect(page.getByRole('textbox', { name: 'Mensagem para a NEXA' })).toBeVisible();
  await expect(page.getByText('convidado')).toBeVisible();
});
