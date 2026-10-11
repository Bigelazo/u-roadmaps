import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import unitConfig from './vitest.config.mts';
import { integrationDatabaseUrl } from './tests/notifications-integration/database';

const connection = integrationDatabaseUrl();
export default defineConfig({
  resolve: unitConfig.resolve,
  test: {
    environment: 'node',
    include: ['tests/notifications-integration/**/*.test.ts'],
    globalSetup: ['tests/notifications-integration/global-setup.ts'],
    setupFiles: ['tests/notifications-integration/setup.ts'],
    env: { DATABASE_URL: connection },
    maxWorkers: 3,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
