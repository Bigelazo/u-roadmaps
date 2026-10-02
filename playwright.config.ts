import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env', quiet: true });
const baseURL = 'http://localhost:3200';
const connection = process.env.E2E_DATABASE_URL;
if (!connection) throw new Error('Set E2E_DATABASE_URL in .env.');
const database = new URL(connection);
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
  database.pathname !== '/roadmap_e2e_db'
) {
  throw new Error('E2E requires the local roadmap_e2e_db database.');
}

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
  MUFASA_TOKEN: '',
  PGCONNECT_TIMEOUT: '5',
  PGOPTIONS: '-c statement_timeout=10000 -c lock_timeout=5000',
});
if (process.env.RUN_NOVU_REALTIME !== '1') {
  process.env.NOVU_SECRET_KEY = '';
  process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER = '';
}

export default defineConfig({
  testDir: './tests/e2e',
  // Temporary shared-fixture baseline; parallel migration is tracked in ADR-0013.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Stop repeated infrastructure failures; use --max-failures=0 for a full audit.
  maxFailures: 3,
  globalTimeout: 15 * 60_000,
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
    stdout: 'pipe',
    timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
