import { expect, test } from '@playwright/test';

import { expectNoHorizontalScroll, useDemoMode } from './helpers';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];

test('HUD não cria rolagem horizontal na matriz de larguras e alturas', async ({ page }) => {
  await useDemoMode(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalScroll(page);
  }
});

test('campos e ações principais mantêm tamanho legível e alvos de toque', async ({ page }) => {
  await useDemoMode(page);
  await page.goto('/');
  test.skip(!(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)), 'aplica-se a dispositivo de toque');
  const composer = page.getByRole('textbox', { name: 'Mensagem para a NEXA' });
  await expect(composer).toBeVisible();
  const fontSize = await composer.evaluate((element) => getComputedStyle(element).fontSize);
  expect(Number.parseFloat(fontSize)).toBeGreaterThanOrEqual(16);

  for (const button of [
    page.getByRole('button', { name: 'Abrir conversas' }),
    page.getByRole('button', { name: 'Abrir ajustes' }),
    page.getByRole('button', { name: 'Enviar mensagem' }),
  ]) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test('mensagem e rascunho sobrevivem à rotação durante a resposta', async ({ page }) => {
  await useDemoMode(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const composer = page.getByRole('textbox', { name: 'Mensagem para a NEXA' });
  await composer.fill('resposta durante rotação');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(page.getByText('resposta durante rotação')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Parar resposta' })).toBeVisible();

  await composer.fill('rascunho preservado');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByText('resposta durante rotação')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Parar resposta' })).toBeVisible();
  await expect(composer).toHaveValue('rascunho preservado');
});
