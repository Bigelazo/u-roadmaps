import type {
  PracticeCanvasAction,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';

/**
 * Wraps the Practice roadmap's persistence so the teaching Roadmap tutorial learns
 * which changes took effect: each is reported only after it succeeded.
 */
export function reportingPracticeActions(
  persistence: RoadmapCanvasSessionPersistence,
  report: (action: PracticeCanvasAction) => void,
): RoadmapCanvasSessionPersistence {
  const {
    addNode,
    connectNodes,
    changeTeacherBlock,
    setVisibility,
    addResource,
    deleteNode,
    loadSimulation,
    completeSimulatedNode,
  } = persistence;
  return {
    ...persistence,
    async addNode(input, ...rest) {
      const nodeId = await addNode(input, ...rest);
      if (nodeId) report({ type: 'addNode', nodeId });
      return nodeId;
    },
    async connectNodes(input, dependency, ...rest) {
      await connectNodes(input, dependency, ...rest);
      const { sourceNodeId, targetNodeId } = dependency;
      report({ type: 'connectNodes', sourceNodeId, targetNodeId });
    },
    async changeTeacherBlock(input, nodeId, operation, ...rest) {
      await changeTeacherBlock(input, nodeId, operation, ...rest);
      report({ type: 'changeTeacherBlock', nodeId, operation });
    },
    async setVisibility(input, nodeId, visible, ...rest) {
      await setVisibility(input, nodeId, visible, ...rest);
      report({ type: 'changeVisibility', nodeId, isVisible: visible });
    },
    async addResource(input, nodeId, ...rest) {
      await addResource(input, nodeId, ...rest);
      report({ type: 'addResource', nodeId });
    },
    async deleteNode(input, nodeId, ...rest) {
      await deleteNode(input, nodeId, ...rest);
      report({ type: 'deleteNode', nodeId });
    },
    async loadSimulation(...args) {
      const simulation = await loadSimulation(...args);
      report({ type: 'enterCanvasPreview' });
      return simulation;
    },
    async completeSimulatedNode(input, nodeId, ...rest) {
      await completeSimulatedNode(input, nodeId, ...rest);
      report({ type: 'completeSimulatedNode', nodeId });
    },
  };
}
