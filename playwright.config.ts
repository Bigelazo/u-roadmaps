import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3200',
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'pnpm exec dotenv -e .env.development -- sh -c \'export DATABASE_URL="$E2E_DATABASE_URL" NEXT_DIST_DIR=".next-e2e" NEXTAUTH_URL="http://localhost:3200" NEXTAUTH_SECRET="e2e-nextauth-secret" VTI_JWT_SECRET="e2e-vti-secret" U_ROADMAPS_E2E_DATA="true"; pnpm exec prisma migrate deploy && pnpm exec tsx --conditions react-server scripts/reset-development-data.ts && pnpm exec next build && pnpm exec next start -p 3200\'',
    env: {
      ...process.env,
      NEXTAUTH_URL: 'http://localhost:3200',
      NEXTAUTH_SECRET: 'e2e-nextauth-secret',
      VTI_JWT_SECRET: 'e2e-vti-secret',
    },
    url: 'http://localhost:3200',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'chrome', use: { ...devices['Desktop Chrome'] } },
  ],
});
