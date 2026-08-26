export function developmentEnvironmentEnabled() {
  if (process.env.NODE_ENV !== 'development' || process.env.U_ROADMAPS_DEV_DATA !== 'true') {
    return false;
  }
  return true;
}

export function requireDevelopmentEnvironment() {
  if (!developmentEnvironmentEnabled()) {
    throw new Error(
      `Development data requires NODE_ENV=development, U_ROADMAPS_DEV_DATA=true, and a local database.`,
    );
  }
}

export function fixtureEnvironmentEnabled() {
  return developmentEnvironmentEnabled() || process.env.U_ROADMAPS_E2E_DATA === 'true';
}

export function requireFixtureEnvironment() {
  if (!fixtureEnvironmentEnabled()) {
    throw new Error(
      `Fixture data requires a local database with its matching fixture flag enabled.`,
    );
  }
}

export const developmentPersonas = [
  { id: '10000000-0000-4000-8000-000000000001', label: 'Docente: Ana Pérez' },
  { id: '10000000-0000-4000-8000-000000000002', label: 'Docente: Bruno Soto' },
  { id: '20000000-0000-4000-8000-000000000001', label: 'Estudiante: sin progreso' },
  { id: '20000000-0000-4000-8000-000000000002', label: 'Estudiante: avance inicial' },
  { id: '20000000-0000-4000-8000-000000000003', label: 'Estudiante: avance ramificado' },
  { id: '20000000-0000-4000-8000-000000000004', label: 'Estudiante: casi completo' },
  { id: '20000000-0000-4000-8000-000000000051', label: 'Estudiante: retirado' },
];
