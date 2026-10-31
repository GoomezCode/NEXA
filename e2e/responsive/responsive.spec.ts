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

test(
  'o Clássico mantém o fundo escuro e os painéis abaixo do cabeçalho em mobile',
  async ({ page }) => {
    await useDemoMode(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?ui=classic');
    const classicBackground = await page
      .locator('.classic-main-area')
      .evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(classicBackground).toContain('radial-gradient');
    await page.getByRole('button', { name: 'Abrir Monitor' }).click();
    const statusTitle = page.getByText('SYSTEM STATUS').first();
    await expect(statusTitle).toBeVisible();
    const [titleBox, headerBox] = await Promise.all([
      statusTitle.boundingBox(),
      page.locator('.classic-topbar').boundingBox(),
    ]);
    expect(titleBox && headerBox).toBeTruthy();
    expect(titleBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  },
);

test('Clássico mantém o núcleo e a navegação acessíveis na matriz responsiva', async ({ page }) => {
  await useDemoMode(page);
  await page.goto('/?ui=classic');
  const consoleInput = page.getByPlaceholder('Escreva sua mensagem...');
  const core = page.locator('.classic-ai-core-orb');

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalScroll(page);
    if (viewport.width < 768) {
      await expect(core).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Painéis do modo clássico' })).toBeHidden();
      await expect(consoleInput).toBeHidden();
      await expect(page.getByRole('button', { name: 'Abrir Chat' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir Memória' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir Monitor' })).toBeVisible();
    } else {
      await expect(page.getByPlaceholder('Enter command or speak...')).toBeVisible();
    }
  }
});

test('aba ativa e rascunho do console sobrevivem à rotação', async ({ page }) => {
  await useDemoMode(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?ui=classic');
  const input = page.getByPlaceholder('Escreva sua mensagem...');
  await page.getByRole('button', { name: 'Abrir Chat' }).click();
  await input.fill('rascunho preservado');
  await page.getByRole('button', { name: 'Abrir Monitor' }).click();
  await expect(page.getByText('SYSTEM STATUS')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir Chat' }).click();
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

test('layout compacto mantém o núcleo em foco e o chat acessível pelo dock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useDemoMode(page);
  await page.goto('/?ui=classic');

  const tabs = page.getByRole('navigation', { name: 'Painéis do modo clássico' });
  const core = page.locator('.classic-ai-core-orb');
  await expect(tabs).toBeHidden();
  await expect(core).toBeVisible();
  await expect(page.getByPlaceholder('Escreva sua mensagem...')).toBeHidden();
  await page.getByRole('button', { name: 'Abrir Chat' }).click();
  const dialog = page.getByRole('dialog', { name: 'Conversa com a NEXA' });
  const chatWindow = page.locator('.classic-mobile-chat-window');
  const consoleInput = page.getByPlaceholder('Escreva sua mensagem...');
  await expect(dialog).toBeVisible();
  await expect(chatWindow).toBeVisible();
  await expect(consoleInput).toBeVisible();

  const [windowBox, inputBox, dockBox, headerBox] = await Promise.all([
    chatWindow.boundingBox(),
    consoleInput.boundingBox(),
    page.locator('.classic-app-dock').boundingBox(),
    page.locator('.classic-topbar').boundingBox(),
  ]);
  expect(windowBox && inputBox && dockBox && headerBox).toBeTruthy();
  expect(windowBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(dockBox!.y);
  expect(await page.locator('.classic-topbar').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.locator('.classic-main-area').evaluate((element) => getComputedStyle(element).zIndex)).toBe('1');
  await page.getByRole('button', { name: 'Abrir Chat' }).click();
  await expect(dialog).toBeHidden();
  await expect(core).toBeVisible();
});

test('Memória e Monitor abrem e fecham pelo mesmo botão no dock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useDemoMode(page);
  await page.goto('/?ui=classic');
  const core = page.locator('.classic-ai-core-orb');

  for (const [name, heading] of [['Monitor', 'SYSTEM STATUS'], ['Memória', 'MEMÓRIAS LOCAIS']]) {
    const button = page.getByRole('button', { name: `Abrir ${name}` });
    await button.click();
    await expect(page.getByText(heading)).toBeVisible();
    await button.click();
    await expect(core).toBeVisible();
  }
});

test('modo clássico continua utilizável com movimento reduzido em 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await useDemoMode(page);
  await page.goto('/?ui=classic');
  await expect(page.locator('.classic-ai-core-orb')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir Chat' }).click();
  await expect(page.getByPlaceholder('Escreva sua mensagem...')).toBeVisible();
  await expectNoHorizontalScroll(page);
});
