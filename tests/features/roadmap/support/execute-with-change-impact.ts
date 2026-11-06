import type { ChangeImpactCommand } from '@/features/roadmap/canvas/commands/commands';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';

export async function executeWithChangeImpact(
  persistence: RoadmapCanvasSessionPersistence,
  command: ChangeImpactCommand,
) {
  const { version } = await persistence.readChangeImpact(command);
  return persistence.execute(command, version);
}
