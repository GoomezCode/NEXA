import { expect, test, type Page } from '@playwright/test';

async function openSkills(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();
  await page.locator('button:visible', { hasText: 'Memória' }).first().click();
  await expect(page.getByRole('heading', { name: 'Memória', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Skills/ }).click();
}

test('cria, filtra, persiste e exclui uma skill sem misturá-la às memórias', async ({ page }) => {
  await openSkills(page);
  await expect(page.getByRole('heading', { name: 'Nenhuma skill ainda' })).toBeVisible();
  await page.getByRole('button', { name: 'Nova skill' }).first().click();
  await page.locator('input[maxlength="60"]').fill('Tutor Python');
  await page.getByLabel('Quando usar').fill('Ao estudar Python');
  await page.getByLabel('Instruções para a IA').fill('Explique conceitos de Python com exemplos curtos.');
  await page.getByRole('button', { name: 'Salvar skill' }).click();

  await expect(page.getByRole('heading', { name: 'Tutor Python' })).toBeVisible();
  await expect(page.getByText('#skill', { exact: true })).toBeVisible();
  await expect(page.getByText('#python', { exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Buscar skills' });
  await search.fill('#python');
  await expect(page.getByRole('heading', { name: 'Tutor Python' })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/memory\?tab=skills/);
  await expect(page.getByRole('heading', { name: 'Tutor Python' })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir Tutor Python' }).click();
  const dialog = page.getByRole('alertdialog', { name: /Excluir.*Tutor Python/ });
  await dialog.getByRole('button', { name: 'Excluir skill' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhuma skill ainda' })).toBeVisible();

  await page.getByRole('tab', { name: /Memórias/ }).click();
  await expect(page.getByText('Nenhuma memória ainda.')).toBeVisible();
});

test.describe('layout mobile de Skills', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('mantém abas e conteúdo na largura visível', async ({ page }) => {
    await openSkills(page);
    const result = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(result.content).toBeLessThanOrEqual(result.viewport);
    const tab = await page.getByRole('tab', { name: /Skills/ }).boundingBox();
    expect(tab?.height).toBeGreaterThanOrEqual(44);
  });
});

test('convidado respeita duas skills e recupera vaga ao excluir', async ({ page }) => {
  await openSkills(page);
  const create = async (name: string) => {
    await page.getByRole('button', { name: 'Nova skill' }).first().click();
    await page.locator('input[maxlength="60"]').fill(name);
    await page.getByLabel('Instruções para a IA').fill(`Instruções de ${name}.`);
    await page.getByRole('button', { name: 'Salvar skill' }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  };
  await create('Skill um');
  await create('Skill dois');
  const createButton = page.getByRole('button', { name: 'Nova skill' }).first();
  await expect(createButton).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText(/Você usou 2 de 2 skills/)).toBeVisible();
  await createButton.dispatchEvent('click');
  await expect(page.locator('input[maxlength="60"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Excluir Skill um' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir skill' }).click();
  await expect(createButton).toHaveAttribute('aria-disabled', 'false');
  await create('Skill tres');
});
