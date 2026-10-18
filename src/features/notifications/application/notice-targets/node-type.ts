import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import {
  isNodeViewer,
  nodeViewers,
  nodeVisibleBefore,
  nodeVisibleThroughout,
  type NoticeTargetDescriptor,
  type TargetValues,
} from './descriptor';

export const nodeTypeRef = (nodeId: string) => ({
  noticeTarget: NOTICE_TARGET.nodeType,
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
 * accessible or blocked (ADR-0014 decision 10); teaching staff see hidden Nodes too
 * (decision 14.5).
 */
export const nodeTypeTarget: NoticeTargetDescriptor<NodeTypeFact> = {
  noticeTarget: NOTICE_TARGET.nodeType,
  noticeClass: 'roadmap-node-changed',
  shownTo: 'node-viewers',
  matches: (fact): fact is NodeTypeFact => fact.kind === 'node-type',
  target: (fact) => nodeTypeRef(fact.nodeId),
  previousValue: (fact) => fact.previous.id,
  previousContext: (fact) => ({ typeName: fact.previous.name }),
  knowers: async (fact, changes, roadmap) =>
    nodeViewers(await nodeVisibleBefore(fact.nodeId, changes, roadmap), roadmap),
  // Revealing a retyped Node is not a type change to students: none saw the previous type.
  audience: async (fact, changes, roadmap) =>
    nodeViewers(await nodeVisibleThroughout(fact.nodeId, changes, roadmap), roadmap),
  async current(target, roadmap, recipientId) {
    const node = await (target.nodeId ? roadmap.node(target.nodeId) : null);
    return node
      ? {
          value: node.nodeTypeId,
          visible: await isNodeViewer(node.isVisible, recipientId, roadmap),
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
