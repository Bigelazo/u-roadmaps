const developmentDatabaseName = 'roadmap_dev_db';

export function developmentEnvironmentEnabled() {
  if (process.env.NODE_ENV !== 'development' || process.env.U_ROADMAPS_DEV_DATA !== 'true') {
    return false;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;
  try {
    const url = new URL(databaseUrl);
    return (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      url.pathname === `/${developmentDatabaseName}`
    );
  } catch {
    return false;
  }
}

export function requireDevelopmentEnvironment() {
  if (!developmentEnvironmentEnabled()) {
    throw new Error(
      `Development data requires NODE_ENV=development, U_ROADMAPS_DEV_DATA=true, and a local ${developmentDatabaseName} database.`,
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
