export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startScheduledUnlockRelease } = await import('@/app/_adapters/scheduled-unlock-release');
  startScheduledUnlockRelease();
}
