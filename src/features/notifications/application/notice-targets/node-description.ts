import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import {
  isNodeViewer,
  nodeOpeners,
  nodeVisibleThroughout,
  type NoticeTargetDescriptor,
  type RoadmapView,
  type TargetValues,
} from './descriptor';

export const nodeDescriptionRef = (nodeId: string) => ({
  noticeTarget: NOTICE_TARGET.nodeDescription,
  targetKey: `node:${nodeId}:description`,
  nodeId,
});

type NodeDescriptionFact = Extract<RoadmapChangeFact, { kind: 'node-description' }>;

async function canOpenNode(nodeId: string, changes: RoadmapChanges, roadmap: RoadmapView) {
  return nodeOpeners(await nodeVisibleThroughout(nodeId, changes, roadmap), nodeId, roadmap);
}

function nodeTitle({ context }: TargetValues) {
  return String(context.nodeTitle ?? '');
}

export const nodeDescriptionTarget: NoticeTargetDescriptor<NodeDescriptionFact> = {
  noticeTarget: NOTICE_TARGET.nodeDescription,
  noticeClass: 'roadmap-node-changed',
  shownTo: 'node-openers',
  matches: (fact): fact is NodeDescriptionFact => fact.kind === 'node-description',
  target: (fact) => nodeDescriptionRef(fact.nodeId),
  previousValue: (fact) => JSON.stringify(fact.previous),
  knowers: (fact, changes, roadmap) => canOpenNode(fact.nodeId, changes, roadmap),
  audience: (fact, changes, roadmap) => canOpenNode(fact.nodeId, changes, roadmap),
  async current(target, roadmap, recipientId) {
    const node = await (target.nodeId ? roadmap.node(target.nodeId) : null);
    return node
      ? {
          value: JSON.stringify(node.description),
          visible: await isNodeViewer(node.isVisible, recipientId, roadmap),
          context: { nodeTitle: node.title },
        }
      : null;
  },
  async entryValues(roadmap, recipientId, known) {
    const accessible = await roadmap.accessibleNodeIds(recipientId);
    const knownKeys = new Set(known.map(({ targetKey }) => targetKey));
    return (await roadmap.nodes()).flatMap((node) => {
      const target = nodeDescriptionRef(node.id);
      if (!accessible.has(node.id) && !knownKeys.has(target.targetKey)) return [];
      return [
        {
          target,
          currentValue: JSON.stringify(node.description),
          context: { nodeTitle: node.title },
        },
      ];
    });
  },
  wording: (values) => ({
    subject: nodeTitle(values),
    body: `Se actualizó la descripción de «${nodeTitle(values)}».`,
    summaryGroup: 'node',
    summary: 'Se actualizó la descripción.',
  }),
  apiData: (values) => ({ nodeTitle: nodeTitle(values) }),
};
