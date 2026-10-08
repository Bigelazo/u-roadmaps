import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { integrationDatabaseUrl } from './tests/notifications-integration/database';

const connection = integrationDatabaseUrl();
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(
        new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url),
      ),
    },
  },
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
