export { developmentPersonas };

export function developmentEnvironmentEnabled() {
  if (process.env.NODE_ENV !== 'development' || process.env.U_ROADMAPS_DEV_DATA !== 'true') {
    return false;
  }
  return true;
}

function approvedFixtureDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;
  try {
    const parsed = new URL(databaseUrl);
    const localHost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
    const databaseName = parsed.pathname.replace(/^\//, '');
    return localHost && ['roadmap_dev_db', 'roadmap_e2e_db'].includes(databaseName);
  } catch {
    return false;
  }
}

export function fixtureEnvironmentEnabled() {
  return (
    (developmentEnvironmentEnabled() || process.env.U_ROADMAPS_E2E_DATA === 'true') &&
    approvedFixtureDatabase()
  );
}

export function requireFixtureEnvironment() {
  if (!fixtureEnvironmentEnabled()) {
    throw new Error(
      `Fixture data requires a local roadmap_dev_db or roadmap_e2e_db database with its matching fixture flag enabled.`,
    );
  }
}

export function isDevelopmentPersona(userId: string) {
  return (
    developmentEnvironmentEnabled() && developmentPersonas.some((persona) => persona.id === userId)
  );
}
import { developmentPersonas } from '@/lib/development-fixtures';
