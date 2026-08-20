import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3200',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm exec next start -p 3200',
    env: {
      ...process.env,
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? '',
      NEXTAUTH_URL: 'http://localhost:3200',
      NEXT_DIST_DIR: '.next-e2e',
    },
    url: 'http://localhost:3200',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
