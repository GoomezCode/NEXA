import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type ViewName = 'chat' | 'ajustes' | 'memória';

const VIEWS: { name: ViewName; open: (page: Page) => Promise<void> }[] = [
  { name: 'chat', open: async () => undefined },
  {
    name: 'ajustes',
    open: async (page) => {
      await page.getByRole('button', { name: 'Abrir ajustes' }).click();
      await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
    },
  },
  {
    name: 'memória',
    open: async (page) => {
      await page.locator('button:visible', { hasText: 'Memória' }).first().click();
      await expect(page.getByRole('heading', { name: 'Memória', exact: true })).toBeVisible();
    },
  },
];

async function expectNoA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const summary = violations
    .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`)
    .join('\n');

  expect(violations, summary).toEqual([]);
}

for (const view of VIEWS) {
  test(`sem violações de acessibilidade em ${view.name}`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

    await view.open(page);
    await expectNoA11yViolations(page);
  });
}

test.describe('em viewport móvel', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const view of VIEWS) {
    test(`sem violações de acessibilidade em ${view.name}`, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();

      await view.open(page);
      await expectNoA11yViolations(page);
    });
  }
});
