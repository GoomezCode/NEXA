import { expect, test } from '@playwright/test';

import { expectNoHorizontalScroll, useDemoMode } from './helpers';

const VIEWPORTS = [
  { width: 320, height: 568 },
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

test('Clássico mantém o console e navegação acessíveis na matriz responsiva', async ({ page }) => {
  await useDemoMode(page);
  await page.goto('/?ui=classic');
  const consoleInput = page.getByPlaceholder('Enter command or speak...');
  await expect(consoleInput).toBeVisible();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalScroll(page);
    await expect(consoleInput).toBeVisible();
    if (viewport.width < 768) {
      await expect(page.getByRole('navigation', { name: 'Painéis do modo clássico' })).toBeVisible();
    }
  }
});

test('aba ativa e rascunho do console sobrevivem à rotação', async ({ page }) => {
  await useDemoMode(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?ui=classic');
  const input = page.getByPlaceholder('Enter command or speak...');
  await input.fill('rascunho preservado');
  const panelTabs = page.getByRole('navigation', { name: 'Painéis do modo clássico' });
  await panelTabs.getByRole('button', { name: 'MONITOR', exact: true }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.setViewportSize({ width: 390, height: 844 });
  await panelTabs.getByRole('button', { name: 'CONSOLE', exact: true }).click();
  await expect(input).toHaveValue('rascunho preservado');
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

test('layout compacto mantém o console visível acima do dock e do cabeçalho', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useDemoMode(page);
  await page.goto('/?ui=classic');

  const tabs = page.getByRole('navigation', { name: 'Painéis do modo clássico' });
  const consolePanel = page.locator('.classic-panel--right');
  const consoleInput = page.getByPlaceholder('Enter command or speak...');
  await expect(tabs).toBeVisible();
  await expect(consoleInput).toBeVisible();

  const [tabBox, panelBox, inputBox, dockBox, headerBox] = await Promise.all([
    tabs.boundingBox(),
    consolePanel.boundingBox(),
    consoleInput.boundingBox(),
    page.locator('.classic-app-dock').boundingBox(),
    page.locator('.classic-topbar').boundingBox(),
  ]);
  expect(tabBox && panelBox && inputBox && dockBox && headerBox).toBeTruthy();
  expect(tabBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  expect(panelBox!.y).toBeGreaterThanOrEqual(tabBox!.y + tabBox!.height);
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(dockBox!.y);
  expect(await page.locator('.classic-topbar').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.locator('.classic-main-area').evaluate((element) => getComputedStyle(element).zIndex)).toBe('1');
  expect(await tabs.evaluate((element) => getComputedStyle(element).zIndex)).toBe('1');
});
