import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import {
  isNodeViewer,
  nodePart,
  nodeRef,
  nodeTitle,
  nodeViewers,
  nodeVisibleBefore,
  nodeVisibleThroughout,
  targetNode,
  type NoticeTargetDescriptor,
  type TargetValues,
} from './descriptor';

const nodeTypeRef = nodeRef(NOTICE_TARGET.nodeType, 'nodeType');

type NodeTypeFact = Extract<RoadmapChangeFact, { kind: 'node-type' }>;

function names(values: TargetValues) {
  return {
    nodeTitle: nodeTitle(values),
    knownTypeName: String(values.knownContext?.typeName ?? ''),
    currentTypeName: String(values.context.typeName ?? ''),
  };
}

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
  audience: async (fact, changes, roadmap) =>
    nodeViewers(await nodeVisibleThroughout(fact.nodeId, changes, roadmap), roadmap),
  async current(target, roadmap, recipientId) {
    const node = await targetNode(target, roadmap);
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
      summaryParts: [
        nodePart(nodeTitle),
        ` pasó de tipo «${knownTypeName}» a tipo «${currentTypeName}».`,
      ],
    };
  },
  apiData: names,
};
