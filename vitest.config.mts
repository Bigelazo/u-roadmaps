import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests that read and write roadmap_notifications_test_db. Their project migrates and
 * cleans the database once per run, before any worker starts, and only when one of them runs.
 */
const notificationsDatabaseTests = [
  'tests/features/roadmap/{change-port-operations,participant-access,preview-version,roadmap-command,stored-file-ownership}.test.ts',
  'tests/prisma/**/*.test.ts',
];

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
    // Let React Testing Library register its automatic cleanup hooks.
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
          name: 'database',
          environment: 'node',
          include: notificationsDatabaseTests,
          globalSetup: ['tests/notifications-integration/global-setup.ts'],
          setupFiles: ['tests/notifications-integration/setup.ts'],
        },
      },
    ],
  },
});
