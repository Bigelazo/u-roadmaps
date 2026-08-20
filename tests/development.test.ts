import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  developmentEnvironmentEnabled,
  fixtureEnvironmentEnabled,
  requireFixtureEnvironment,
} from '@/lib/development';

const originalEnvironment = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnvironment };
});

describe('fixture environment', () => {
  it('allows the local development database in development mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('U_ROADMAPS_DEV_DATA', 'true');
    vi.stubEnv('DATABASE_URL', 'postgresql://local:local@localhost:5432/roadmap_dev_db');

    expect(fixtureEnvironmentEnabled()).toBe(true);
  });

  it('allows Prisma Dev in development mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('U_ROADMAPS_DEV_DATA', 'true');
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:51214/template1');

    expect(developmentEnvironmentEnabled()).toBe(true);
  });

  it('allows the local E2E database only when E2E fixture loading is enabled', () => {
    vi.stubEnv('U_ROADMAPS_E2E_DATA', 'true');
    vi.stubEnv('DATABASE_URL', 'postgresql://local:local@127.0.0.1:5432/roadmap_e2e_db');

    expect(fixtureEnvironmentEnabled()).toBe(true);
  });

  it('rejects remote and unapproved database targets', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('U_ROADMAPS_DEV_DATA', 'true');
    vi.stubEnv('DATABASE_URL', 'postgresql://local:local@db.example.test:5432/roadmap_dev_db');

    expect(fixtureEnvironmentEnabled()).toBe(false);
    expect(() => requireFixtureEnvironment()).toThrow(
      /local roadmap_dev_db or roadmap_e2e_db database/,
    );
  });

  it('rejects an unapproved local database name', () => {
    vi.stubEnv('U_ROADMAPS_E2E_DATA', 'true');
    vi.stubEnv('DATABASE_URL', 'postgresql://local:local@localhost:5432/other_db');

    expect(fixtureEnvironmentEnabled()).toBe(false);
    expect(() => requireFixtureEnvironment()).toThrow(
      /local roadmap_dev_db or roadmap_e2e_db database/,
    );
  });
});
