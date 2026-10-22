import type {
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';
import type { RoadmapDependencyRequest } from '@/features/roadmap/types';

export function confirmedWrites(
  persistence: RoadmapCanvasSessionPersistence,
  input: RoadmapCanvasSessionInput,
) {
  return {
    async connect(dependency: RoadmapDependencyRequest) {
      const { version } = await persistence.previewRoadmapDependency(input, dependency);
      await persistence.connectNodes(input, dependency, version);
    },
    async hide(nodeId: string) {
      const { version } = await persistence.previewNodeHiding(input, nodeId);
      await persistence.setVisibility(input, nodeId, false, version);
    },
    async delete(nodeId: string) {
      const { version } = await persistence.previewNodeDeletion(input, nodeId);
      await persistence.deleteNode(input, nodeId, version);
    },
    async block(nodeId: string) {
      const { version } = await persistence.previewTeacherBlock(input, nodeId, 'BLOCK');
      await persistence.changeTeacherBlock(input, nodeId, 'BLOCK', version);
    },
  };
}
