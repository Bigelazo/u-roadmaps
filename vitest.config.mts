import { fileURLToPath } from 'node:url';
import { defineConfig, type TestUserConfig } from 'vitest/config';

const notificationsDatabaseTests = [
  'tests/features/roadmap/{change-port-operations,participant-access,preview-version,resource-access,roadmap-command,stored-file-ownership}.test.ts',
  'tests/features/roadmap/application/academic-participation.test.ts',
  'tests/prisma/**/*.test.ts',
];

export const notificationsDatabaseHarness: TestUserConfig = {
  environment: 'node',
  globalSetup: ['tests/notifications-integration/global-setup.ts'],
  setupFiles: ['tests/notifications-integration/setup.ts'],
};

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
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: [
            'tests/notifications-integration/**',
            ...notificationsDatabaseTests,
            'node_modules/**',
          ],
        },
      },
      {
        extends: true,
        test: {
          ...notificationsDatabaseHarness,
          name: 'database',
          include: notificationsDatabaseTests,
        },
      },
    ],
  },
});
