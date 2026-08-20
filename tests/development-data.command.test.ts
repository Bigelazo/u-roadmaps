import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('rejects a non-local database before loading fixture data', () => {
  const result = spawnSync('pnpm', ['exec', 'tsx', 'prisma/development-data.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      U_ROADMAPS_DEV_DATA: 'true',
      DATABASE_URL: 'postgresql://fixture:fixture@db.example.test:5432/roadmap_dev_db',
    },
    encoding: 'utf8',
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/local roadmap_dev_db or roadmap_e2e_db database/);
});
