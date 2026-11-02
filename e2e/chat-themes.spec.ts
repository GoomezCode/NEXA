import { expect, test } from '@playwright/test';

const themes = [
  'hud',
  'violet',
  'rose',
  'classic',
  'light',
  'light-rose',
  'light-lavender',
  'light-mint',
  'contrast',
] as const;

function luminance(color: string): number {
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!values || values.length !== 3) throw new Error(`Cor computada inválida: ${color}`);
  const scale = color.startsWith('color(srgb') ? 1 : 255;
  const channels = values.map((value) => {
    const normalized = value / scale;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker! + 0.05);
}

test('temas do chat trocam em tempo real e mantêm contraste nos tokens semânticos', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');
  const picker = page.getByLabel('Tema da interface');
  await expect(picker).toBeVisible();

  for (const theme of themes) {
    await picker.selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const colors = await page.evaluate(() => {
      const root = document.documentElement;
      const probe = document.createElement('span');
      probe.style.position = 'fixed';
      probe.style.visibility = 'hidden';
      root.append(probe);
      const color = (foreground: string, background: string) => {
        probe.style.color = `var(${foreground})`;
        probe.style.backgroundColor = `var(${background})`;
        const style = getComputedStyle(probe);
        return { foreground: style.color, background: style.backgroundColor };
      };
      const body = color('--text', '--bg');
      const muted = color('--text-muted', '--bg');
      const accentText = color('--accent-readable', '--bg');
      const accent = color('--accent-contrast', '--accent');
      const code = color('--text', '--code-bg');
      probe.remove();
      return { body, muted, accentText, accent, code };
    });

    expect(contrastRatio(colors.body.foreground, colors.body.background), `${theme} body text`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.muted.foreground, colors.muted.background), `${theme} secondary text`).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.accentText.foreground, colors.accentText.background), `${theme} links`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.accent.foreground, colors.accent.background), `${theme} send button`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.code.foreground, colors.code.background), `${theme} code`).toBeGreaterThanOrEqual(4.5);
  }

  expect(pageErrors).toEqual([]);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();
  await expect(page.locator('.nexa-markdown')).toBeVisible();
  const layout = await page.evaluate(() => ({
    conversationWidth: document.querySelector('.nexa-conversation')?.getBoundingClientRect().width ?? 0,
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.conversationWidth).toBeLessThanOrEqual(760);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
