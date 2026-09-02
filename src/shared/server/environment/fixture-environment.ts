export function developmentEnvironmentEnabled(environment: NodeJS.ProcessEnv) {
  return environment.NODE_ENV === 'development' && environment.U_ROADMAPS_DEV_DATA === 'true';
}

function approvedFixtureDatabase(environment: NodeJS.ProcessEnv) {
  const databaseUrl = environment.DATABASE_URL;
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

export function fixtureEnvironmentEnabled(environment: NodeJS.ProcessEnv) {
  return (
    (developmentEnvironmentEnabled(environment) || environment.U_ROADMAPS_E2E_DATA === 'true') &&
    approvedFixtureDatabase(environment)
  );
}

export function requireFixtureEnvironment(environment: NodeJS.ProcessEnv) {
  if (!fixtureEnvironmentEnabled(environment)) {
    throw new Error(
      'Fixture data requires a local roadmap_dev_db or roadmap_e2e_db database with its matching fixture flag enabled.',
    );
  }
}
