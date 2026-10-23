import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import unitConfig, { notificationsDatabaseHarness } from './vitest.config.mts';
import { integrationDatabaseUrl } from './tests/notifications-integration/database';

const connection = integrationDatabaseUrl();
export default defineConfig({
  resolve: unitConfig.resolve,
  test: {
    ...notificationsDatabaseHarness,
    include: ['tests/notifications-integration/**/*.test.ts'],
    env: { DATABASE_URL: connection },
    maxWorkers: 3,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
