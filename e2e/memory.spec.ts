import { expect, test, type Page } from '@playwright/test';

async function openMemory(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  await page.locator('button:visible', { hasText: 'Memória' }).first().click();
  await expect(page.getByRole('heading', { name: 'Memória', exact: true })).toBeVisible();
}

test('cria, busca, persiste, edita e esquece uma memória', async ({ page }) => {
  await openMemory(page);
  await expect(page.getByText('Nenhuma memória ainda.')).toBeVisible();

  await page.getByRole('button', { name: 'Nova memória' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Preferência de voz');
  await page
    .getByLabel('Conteúdo', { exact: true })
    .fill('Responder com tom calmo e frases curtas.');
  await page.getByLabel('Tags', { exact: true }).fill('voz, preferências');
  await page.getByRole('button', { name: 'Salvar memória' }).click();

  await expect(page.getByRole('heading', { name: 'Preferência de voz' })).toBeVisible();
  await expect(page.getByText('Responder com tom calmo e frases curtas.')).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Buscar memórias' });
  await search.fill('preferencias');
  await expect(page.getByRole('heading', { name: 'Preferência de voz' })).toBeVisible();

  await search.fill('inexistente');
  await expect(page.getByText('Nenhuma memória encontrada.')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();

  await page.reload();
  await expect(page).toHaveURL(/\/memory$/);
  await expect(page.getByRole('heading', { name: 'Memória', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preferência de voz' })).toBeVisible();

  await page.getByRole('button', { name: 'Editar Preferência de voz' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Preferência de voz atualizada');
  await page.getByRole('button', { name: 'Salvar memória' }).click();
  await expect(page.getByRole('heading', { name: 'Preferência de voz atualizada' })).toBeVisible();

  await page.getByRole('button', { name: 'Esquecer Preferência de voz atualizada' }).click();
  const dialog = page.getByRole('alertdialog', {
    name: /Esquecer.*Preferência de voz atualizada/,
  });
  await dialog.getByRole('button', { name: 'Esquecer' }).click();

  await expect(page.getByText('Nenhuma memória ainda.')).toBeVisible();
});
