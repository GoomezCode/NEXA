import { expect, test } from '@playwright/test';

test('persiste as preferências dos ajustes após recarregar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();

  const name = page.getByRole('textbox', { name: 'Como a NEXA deve chamar você' });
  await name.fill('Marina');

  await page.getByRole('switch', { name: 'Reduzir animações' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');

  await page.reload();
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();

  await expect(page.getByRole('textbox', { name: 'Como a NEXA deve chamar você' })).toHaveValue(
    'Marina',
  );
  await expect(page.getByRole('switch', { name: 'Reduzir animações' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('mantém a entrada por voz desligada após recarregar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();

  const voiceSwitch = page.getByRole('switch', { name: 'Entrada por voz' });
  await voiceSwitch.click();
  await expect(voiceSwitch).toHaveAttribute('aria-checked', 'false');

  await page.reload();
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();

  await expect(page.getByRole('switch', { name: 'Entrada por voz' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});

test('persiste a aparência selecionada e aplica o tema ao documento', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await page.getByLabel('Tema da interface').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();
  await expect(page.getByLabel('Tema da interface')).toHaveValue('light');
});

test('restaura os padrões dos ajustes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();

  const name = page.getByRole('textbox', { name: 'Como a NEXA deve chamar você' });
  await name.fill('Marina');
  await page.getByRole('button', { name: 'Restaurar padrões' }).click();

  await expect(name).toHaveValue('');
  await expect(name).toHaveAttribute('placeholder', 'Seu nome');
});

test('o aviso de demonstração leva aos ajustes', async ({ page }) => {
  await page.goto('/');

  const banner = page.getByRole('status', { name: 'Aviso de demonstração' });
  await expect(banner).toContainText(/respostas simuladas localmente/i);

  await banner.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PERFIL' })).toBeVisible();
});
