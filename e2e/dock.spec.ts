import { expect, test } from '@playwright/test';

import { useDemoMode } from './responsive/helpers';

const navigation = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Navegação principal' });

test.describe('barra inferior', () => {
  test('alterna conversas e o painel do núcleo no desktop', async ({ page }) => {
    await useDemoMode(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

    const nav = navigation(page);
    const conversations = nav.getByRole('button', { name: /conversas/i });
    const core = nav.getByRole('button', { name: /painel do núcleo/i });
    const sidebar = page.getByRole('complementary', { name: 'Conversas' });
    const panel = page.getByRole('complementary', { name: 'Painel do núcleo' });

    await expect(sidebar).toBeVisible();
    await expect(panel).toBeVisible();
    await expect(conversations).toHaveAttribute('aria-pressed', 'true');
    await expect(core).toHaveAttribute('aria-pressed', 'true');

    await conversations.click();
    await expect(sidebar).toBeHidden();
    await expect(conversations).toHaveAttribute('aria-pressed', 'false');

    await conversations.click();
    await expect(sidebar).toBeVisible();

    await core.click();
    await expect(panel).toBeHidden();
    await expect(core).toHaveAttribute('aria-pressed', 'false');

    await core.click();
    await expect(panel).toBeVisible();
  });

  test('o relógio atualiza sozinho sem recarregar a conversa', async ({ page }) => {
    await useDemoMode(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

    const clock = navigation(page).locator('time');
    await expect(clock).toBeVisible();
    const first = await clock.textContent();
    expect(first).toMatch(/\d{2}:\d{2}:\d{2}/);

    await expect(clock).not.toHaveText(first ?? '', { timeout: 3_000 });
    await expect(page.getByText(/NEXA online/)).toBeVisible();
  });

  test('mostra o indicador offline e permite sair pelos ajustes', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('nexa:connection:v1', JSON.stringify({ mode: 'offline' }));
    });
    await page.goto('/');

    const offline = page.getByRole('status', { name: 'Modo offline' });
    await expect(offline).toBeVisible();
    await expect(offline).toContainText(/Ollama local/i);

    await navigation(page).getByRole('button', { name: 'Ajustes' }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
    await page.getByRole('button', { name: 'Sair do offline' }).click();

    await expect(offline).toBeHidden();
  });
});

test.describe('barra inferior em tela estreita', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mantém toggles acessíveis e abas somente com ícone', async ({ page }) => {
    await useDemoMode(page);
    await page.goto('/');

    const nav = navigation(page);
    await expect(nav.getByRole('button', { name: /conversas/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /painel do núcleo/i })).toBeVisible();

    for (const name of ['Chat', 'Memória', 'Monitor', 'Ajustes']) {
      const button = nav.getByRole('button', { name });
      await expect(button).toBeVisible();
      await expect(button.locator('span')).toBeHidden();
    }

    await expect(nav.locator('time')).toBeVisible();
    await expect(nav.locator('time + span')).toBeHidden();

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(nav.locator('time')).toBeHidden();
    await expect(nav.getByRole('button', { name: 'Chat' })).toBeVisible();
  });

  test('offline em 320px mantém o ponto e não cria rolagem horizontal', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('nexa:connection:v1', JSON.stringify({ mode: 'offline' }));
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');

    await expect(page.getByRole('status', { name: 'Modo offline' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  });
});
