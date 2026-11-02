import { expect, test, type Locator } from '@playwright/test';

async function expectMinTarget(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  expect(box, `Alvo "${label}" não encontrado`).not.toBeNull();
  expect(box?.width ?? 0, `largura de "${label}"`).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0, `altura de "${label}"`).toBeGreaterThanOrEqual(44);
}

test.describe('alvos de toque no mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('controles principais têm pelo menos 44px', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

    await expectMinTarget(page.getByRole('button', { name: /conversas/i }), 'Conversas');
    await expectMinTarget(
      page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Ajustes' }),
      'Ajustes',
    );
    await expectMinTarget(
      page.getByRole('button', { name: /Entrada por voz/i }),
      'Entrada por voz',
    );
    await expectMinTarget(page.getByRole('button', { name: 'Enviar mensagem' }), 'Enviar mensagem');

    const nav = page.getByRole('navigation', { name: 'Navegação principal' });

    for (const name of ['Chat', 'Memória', 'Monitor', 'Ajustes']) {
      await expectMinTarget(nav.getByRole('button', { name }), `Dock: ${name}`);
    }
  });

  test('ações da conversa têm pelo menos 44px', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

    await page.getByRole('button', { name: /conversas/i }).click();
    const sheet = page.getByRole('dialog', { name: 'Conversas' });

    await expectMinTarget(
      sheet.getByRole('button', { name: 'Renomear Boas-vindas' }),
      'Renomear conversa',
    );
    await expectMinTarget(
      sheet.getByRole('button', { name: 'Excluir Boas-vindas' }),
      'Excluir conversa',
    );
  });
});
