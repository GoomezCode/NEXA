import { expect, test } from '@playwright/test';

test('alterna para o modo clássico e volta ao NEXA HUD', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  await page.getByRole('button', { name: 'Modo clássico' }).click();

  await expect(page.getByText('SYSTEM STATUS')).toBeVisible();
  await expect(page.getByText('NEXA AI', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voltar ao NEXA HUD' })).toBeVisible();

  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/NEXUS/i);

  await page.getByRole('button', { name: 'Voltar ao NEXA HUD' }).click();
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();
});

test('mantém o modo escolhido após recarregar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  await page.getByRole('button', { name: 'Modo clássico' }).click();
  await expect(page.getByText('SYSTEM STATUS')).toBeVisible();

  await page.reload();
  await expect(page.getByText('SYSTEM STATUS')).toBeVisible();

  await page.getByRole('button', { name: 'Voltar ao NEXA HUD' }).click();
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();
});

test('alterna o modo com Alt+M', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  await page.keyboard.press('Alt+m');
  await expect(page.getByText('SYSTEM STATUS')).toBeVisible();

  await page.keyboard.press('Alt+m');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();
});

test('abre o modo clássico direto por ?ui=classic', async ({ page }) => {
  await page.goto('/?ui=classic');

  await expect(page.getByText('SYSTEM STATUS')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voltar ao NEXA HUD' })).toBeVisible();
});

test('envia uma mensagem ao chat compartilhado no modo clássico', async ({ page }) => {
  await page.goto('/?ui=classic');
  await expect(page.getByText('SYSTEM STATUS')).toBeVisible();

  const composer = page.getByPlaceholder('Enter command or speak...');
  await composer.fill('Como está o sistema?');
  await composer.press('Enter');

  await expect(page.getByText('Como está o sistema?')).toBeVisible();
  await expect(page.getByText(/Núcleo NEXA operacional/)).toBeVisible({ timeout: 10_000 });
});

test('abre e fecha os overlays clássicos, inclusive com Esc', async ({ page }) => {
  await page.goto('/?ui=classic');
  await expect(page.getByText('SYSTEM STATUS')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).first().click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeHidden();

  await page.getByRole('button', { name: 'Apps' }).first().click();
  await expect(page.getByText('ATALHOS DISPONÍVEIS')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('ATALHOS DISPONÍVEIS')).toBeHidden();
});

test.describe('em viewport móvel', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mostra o aviso de compatibilidade e permite continuar', async ({ page }) => {
    await page.goto('/?ui=classic');

    await expect(page.getByText('NEXA CLASSIC')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voltar ao NEXA HUD' })).toBeVisible();

    await page.getByRole('button', { name: 'Continuar mesmo assim' }).click();
  await expect(page.getByText('SYSTEM STATUS')).toBeVisible();
  });
});
