import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { e2eDatabaseUrl } from './tests/e2e/database';

config({ path: '.env', quiet: true });
const baseURL = 'http://localhost:3200';
const connection = e2eDatabaseUrl();

// One environment for the runner, preparation, build and application server.
Object.assign(process.env, {
  DATABASE_URL: connection,
  NEXTAUTH_URL: baseURL,
  NEXTAUTH_SECRET: 'e2e-nextauth-secret',
  VTI_JWT_SECRET: 'e2e-vti-secret',
  NEXT_PUBLIC_VTI_LOGIN_URL: 'https://vti.example.test/login',
  U_ROADMAPS_DEV_DATA: 'false',
  U_ROADMAPS_E2E_DATA: 'true',
  NEXT_DIST_DIR: '.next-e2e',
  UPLOADS_DIRECTORY: 'uploads-e2e',
  MUFASA_TOKEN: 'e2e-ucampus-token',
  MUFASA_BASE_URL: 'http://127.0.0.1:3201',
  PGCONNECT_TIMEOUT: '5',
  PGOPTIONS: '-c statement_timeout=10000 -c lock_timeout=5000',
  // Scheduled unlock specs wait for the in-process release instead of the default 5 minutes.
  SCHEDULED_UNLOCK_INTERVAL_MS: '1000',
});
export default defineConfig({
  testDir: './tests/e2e',
  // Removes test-owned data left by interrupted runs (ADR-0013).
  globalSetup: './tests/e2e/global-setup.ts',
  // Per-test data isolation (ADR-0013); worker count measured in issue #168.
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Stop repeated infrastructure failures; use --max-failures=0 for a full audit.
  maxFailures: 3,
  // Bounds preparation and the complete suite in both browsers.
  globalTimeout: 25 * 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: baseURL,
    // Browser startup is a worker fixture, outside the normal test/action timeout.
    launchOptions: { timeout: 10_000 },
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: [
      'pnpm exec prisma migrate deploy',
      'node --conditions=react-server --import=tsx scripts/reset-development-data.ts',
      'pnpm exec next build',
      'pnpm exec next start -p 3200',
    ].join(' && '),
    url: baseURL,
    reuseExistingServer: false,
    // Keep test results clear; DEBUG=pw:webserver restores server output.
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
