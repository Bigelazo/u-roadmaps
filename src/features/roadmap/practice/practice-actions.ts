import type {
  PracticeCanvasAction,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';

/**
 * Wraps the Practice roadmap's persistence so the teaching Roadmap tutorial learns
 * when a Node was added or connected: reported only after the change succeeded.
 */
export function reportingPracticeActions(
  persistence: RoadmapCanvasSessionPersistence,
  report: (action: PracticeCanvasAction) => void,
): RoadmapCanvasSessionPersistence {
  const { addNode, connectNodes } = persistence;
  if (!addNode || !connectNodes) return persistence;
  return {
    ...persistence,
    async addNode(...args) {
      const nodeId = await addNode(...args);
      if (nodeId) report({ type: 'addNode', nodeId });
      return nodeId;
    },
    async connectNodes(input, sourceNodeId, targetNodeId, ...rest) {
      await connectNodes(input, sourceNodeId, targetNodeId, ...rest);
      report({ type: 'connectNodes', sourceNodeId, targetNodeId });
    },
  };
}
