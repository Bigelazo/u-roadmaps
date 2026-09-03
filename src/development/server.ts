import 'server-only';

export { isDevelopmentPersona } from './server/personas';

export async function assertFixtureEnvironment() {
  const { requireFixtureEnvironment } = await import('@/shared/server/environment/development');
  requireFixtureEnvironment();
}

export async function resetDevelopmentData() {
  await assertFixtureEnvironment();
  const { resetDevelopmentData: reset } = await import('./server/data');
  await reset();
}

export async function seedPredefinedNodeTypes() {
  const { seedPredefinedNodeTypes: seed } = await import('./server/data');
  await seed();
}
