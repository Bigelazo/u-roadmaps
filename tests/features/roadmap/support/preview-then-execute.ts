import type {
  PreviewedCommand,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';

/** Reads a Confirmed action's Change impact and executes it with that impact's version. */
export async function previewThenExecute(
  persistence: RoadmapCanvasSessionPersistence,
  command: PreviewedCommand,
) {
  const { version } = await persistence.preview(command);
  return persistence.execute(command, version);
}
