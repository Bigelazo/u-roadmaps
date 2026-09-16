import type { StudentRoadmapDto } from '@/features/roadmap/types';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';

function copy<T>(value: T): T {
  return structuredClone(value);
}

/** Test adapter for the public canvas session seam. */
export function createInMemoryRoadmapSessionPersistence(
  initialRoadmap: StudentRoadmapDto,
): RoadmapCanvasSessionPersistence {
  let roadmap = copy(initialRoadmap);
  return {
    async load() {
      return copy(roadmap);
    },
    async complete(_input, nodeId) {
      roadmap = {
        ...roadmap,
        nodes: roadmap.nodes.map((node) =>
          node.id === nodeId && 'isCompleted' in node
            ? { ...node, isCompleted: true, canComplete: false }
            : node,
        ),
      };
    },
  };
}
