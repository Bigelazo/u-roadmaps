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
    toggleVisibility,
    addResource,
    deleteNode,
    loadSimulation,
    completeSimulatedNode,
  } = persistence;
  if (
    !addNode ||
    !connectNodes ||
    !changeTeacherBlock ||
    !toggleVisibility ||
    !addResource ||
    !deleteNode ||
    !loadSimulation ||
    !completeSimulatedNode
  )
    return persistence;
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
    async changeTeacherBlock(input, nodeId, operation, ...rest) {
      await changeTeacherBlock(input, nodeId, operation, ...rest);
      report({ type: 'changeTeacherBlock', nodeId, operation });
    },
    async toggleVisibility(input, nodeId, isVisible, ...rest) {
      await toggleVisibility(input, nodeId, isVisible, ...rest);
      report({ type: 'changeVisibility', nodeId, isVisible: !isVisible });
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
