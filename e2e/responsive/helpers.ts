import { expect, type Page } from '@playwright/test';

export async function useDemoMode(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('nexa:settings:v1', JSON.stringify({ demoMode: true }));
  });
}

export async function expectNoHorizontalScroll(page: Page) {
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll, `documento com rolagem horizontal: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(
    dimensions.client,
  );
}
