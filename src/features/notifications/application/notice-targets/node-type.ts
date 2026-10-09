import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import { nodeVisibleBefore, type NoticeTargetDescriptor, type TargetValues } from './descriptor';

export const nodeTypeRef = (nodeId: string) => ({
  noticeTarget: 'node-type',
  targetKey: `node:${nodeId}:nodeType`,
  nodeId,
});

type NodeTypeFact = Extract<RoadmapChangeFact, { kind: 'node-type' }>;

function names({ context, knownContext }: TargetValues) {
  return {
    nodeTitle: String(context.nodeTitle ?? ''),
    knownTypeName: String(knownContext?.typeName ?? ''),
    currentTypeName: String(context.typeName ?? ''),
  };
}

/**
 * Node type: compared by type identity and worded with the type names the recipient
 * knew, which survive later Node type renames. Whoever sees the Node is told,
 * accessible or blocked (ADR-0014 decision 10).
 */
export const nodeTypeTarget: NoticeTargetDescriptor<NodeTypeFact> = {
  noticeTarget: 'node-type',
  noticeClass: 'roadmap-node-changed',
  readSide: { changeKind: 'node-updated', changedFields: ['nodeType'], targetKind: 'node' },
  matches: (fact): fact is NodeTypeFact => fact.kind === 'node-type',
  target: (fact) => nodeTypeRef(fact.nodeId),
  previousValue: (fact) => fact.previous.id,
  previousContext: (fact) => ({ typeName: fact.previous.name }),
  async knowers(fact, changes, roadmap) {
    if (!(await nodeVisibleBefore(fact.nodeId, changes, roadmap))) return [];
    return (await roadmap.participants()).map(({ userId }) => userId);
  },
  async audience(fact, changes, roadmap) {
    // Revealing a retyped Node is not a type change: nobody saw the previous type.
    if (!(await nodeVisibleBefore(fact.nodeId, changes, roadmap))) return [];
    if (!(await roadmap.node(fact.nodeId))?.isVisible) return [];
    return (await roadmap.participants()).map(({ userId }) => userId);
  },
  async current(target, roadmap) {
    const node = target.nodeId ? await roadmap.node(target.nodeId) : null;
    return node
      ? {
          value: node.nodeTypeId,
          visible: node.isVisible,
          context: { typeName: node.nodeTypeName, nodeTitle: node.title },
        }
      : null;
  },
  entryValues: async (roadmap) =>
    (await roadmap.nodes()).map((node) => ({
      target: nodeTypeRef(node.id),
      currentValue: node.nodeTypeId,
      context: { typeName: node.nodeTypeName, nodeTitle: node.title },
    })),
  wording(values) {
    const { nodeTitle, knownTypeName, currentTypeName } = names(values);
    return {
      subject: nodeTitle,
      body: `«${nodeTitle}» pasó de tipo «${knownTypeName}» a tipo «${currentTypeName}».`,
      summaryGroup: 'general',
    };
  },
  apiData: names,
};
