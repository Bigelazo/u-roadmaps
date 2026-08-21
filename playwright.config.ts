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
    command: 'pnpm exec next build && pnpm exec next start -p 3200',
    env: {
      ...process.env,
      NEXTAUTH_URL: 'http://localhost:3200',
    },
    url: 'http://localhost:3200',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'chrome', use: { ...devices['Desktop Chrome'] } },],
});
