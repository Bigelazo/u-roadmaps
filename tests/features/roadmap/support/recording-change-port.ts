import type { RoadmapChangePort, RoadmapChanges } from '@/features/roadmap/server';

export function recordingChangePort() {
  const changes: RoadmapChanges[] = [];
  const port: RoadmapChangePort = {
    async report(_transaction, change) {
      changes.push(structuredClone(change));
    },
  };
  return { port, changes, facts: () => changes.flatMap(({ facts }) => facts) };
}
