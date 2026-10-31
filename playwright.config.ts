import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_MOCK_TOKEN_DELAY: '60',
      // Os e2e exercitam o adaptador mock, independente do .env local.
      VITE_DEMO_MODE: 'true',
    },
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/responsive/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'responsive-chromium',
      testMatch: '**/responsive/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'responsive-firefox',
      testMatch: '**/responsive/**/*.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'responsive-webkit',
      testMatch: '**/responsive/**/*.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
