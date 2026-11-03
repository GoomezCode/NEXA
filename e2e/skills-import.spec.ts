import { expect, test, type Page } from '@playwright/test';

async function openSkills(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();
  await page.locator('button:visible', { hasText: 'Memória' }).first().click();
  await page.getByRole('tab', { name: /Skills/ }).click();
}

const markdown = `---
name: Revisor de código
description: Ao receber trechos de código, revisar bugs e legibilidade
tags: [código, revisão, python]
license: MIT
---
Revise o código em três partes e mostre o trecho corrigido.`;

test('importa arquivo Markdown pelo seletor, permite revisar e persiste a skill', async ({ page }) => {
  await openSkills(page);
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: 'revisor-de-codigo.md', mimeType: 'text/markdown', buffer: Buffer.from(markdown) });

  await expect(page.getByText('Importada de revisor-de-codigo.md')).toBeVisible();
  await expect(page.locator('input[maxlength="60"]')).toHaveValue('Revisor de código');
  await expect(page.getByLabel('Quando usar')).toHaveValue('Ao receber trechos de código, revisar bugs e legibilidade');
  await expect(page.getByLabel('Instruções para a IA')).toHaveValue('Revise o código em três partes e mostre o trecho corrigido.');
  await expect(page.getByText('1 campo ignorado: license')).toBeVisible();
  await expect(page.getByText(/#skill/)).toBeVisible();
  await expect(page.getByText(/#python/)).toBeVisible();

  await page.getByRole('button', { name: 'Salvar skill' }).click();
  await expect(page.getByRole('heading', { name: 'Revisor de código' })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/memory\?tab=skills/);
  await expect(page.getByRole('heading', { name: 'Revisor de código' })).toBeVisible();
});

test('arrastar um Markdown na área da aba preenche o formulário sem abrir o arquivo', async ({ page }) => {
  await openSkills(page);
  await expect(page.getByTestId('skills-drop-area')).toBeVisible();
  await page.evaluate((text) => {
    const area = document.querySelector('[data-testid="skills-drop-area"]');
    if (!area) throw new Error('Área de Skills não encontrada');
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], 'skill-drop.md', { type: 'text/markdown' }));
    area.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
    area.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }));
    area.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, markdown);
  await expect(page.locator('input[maxlength="60"]')).toHaveValue('Revisor de código');
  await expect(page).toHaveURL(/\/memory\?tab=skills/);
});

test('a importação em lote respeita as vagas restantes e marca o arquivo excedente', async ({ page }) => {
  await openSkills(page);
  await page.getByRole('button', { name: 'Nova skill' }).first().click();
  await page.locator('input[maxlength="60"]').fill('Skill existente');
  await page.getByLabel('Instruções para a IA').fill('Instruções existentes.');
  await page.getByRole('button', { name: 'Salvar skill' }).click();

  await page.locator('input[type="file"]').setInputFiles([
    { name: 'skill-a.md', mimeType: 'text/markdown', buffer: Buffer.from('---\nname: Skill A\n---\nInstruções A.') },
    { name: 'skill-b.md', mimeType: 'text/markdown', buffer: Buffer.from('---\nname: Skill B\n---\nInstruções B.') },
  ]);
  await expect(page.getByRole('heading', { name: 'Resumo da importação' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importar 2 skills' })).toBeVisible();
  await page.getByRole('button', { name: 'Importar 2 skills' }).click();
  await expect(page.getByText(/✔ importada/)).toBeVisible();
  await expect(page.getByText(/⚠ não importada/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resumo da importação' }).getByText(/Você usou 2 de 2 skills/)).toBeVisible();
});
