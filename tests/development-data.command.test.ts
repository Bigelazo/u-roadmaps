import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('development reset command rejects a non-local database before it can seed data', () => {
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
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local roadmap_dev_db database/);
});
