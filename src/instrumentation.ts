export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startRoadmapClosure } = await import('@/app/_adapters/roadmap-closure');
  startRoadmapClosure();
  const { startScheduledUnlockRelease } = await import('@/app/_adapters/scheduled-unlock-release');
  startScheduledUnlockRelease();
}
