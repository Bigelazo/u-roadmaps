import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import {
  nodeVisibleBefore,
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

/** Participants who can open the Node now; nobody when it was revealed or hidden by this change. */
async function canOpenNode(nodeId: string, changes: RoadmapChanges, roadmap: RoadmapView) {
  if (!(await nodeVisibleBefore(nodeId, changes, roadmap))) return [];
  if (!(await roadmap.node(nodeId))?.isVisible) return [];
  const participants = await roadmap.participants();
  const accessible = await Promise.all(
    participants.map(async ({ userId }) => (await roadmap.accessibleNodeIds(userId)).has(nodeId)),
  );
  return participants.filter((_, index) => accessible[index]).map(({ userId }) => userId);
}

function nodeTitle({ context }: TargetValues) {
  return String(context.nodeTitle ?? '');
}

/**
 * Node description: compared as exact text; only recipients for whom the Node is
 * accessible know it or are told (ADR-0014 decision 10).
 */
export const nodeDescriptionTarget: NoticeTargetDescriptor<NodeDescriptionFact> = {
  noticeTarget: NOTICE_TARGET.nodeDescription,
  noticeClass: 'roadmap-node-changed',
  readSide: { changeKind: 'node-updated', changedFields: ['description'], targetKind: 'node' },
  matches: (fact): fact is NodeDescriptionFact => fact.kind === 'node-description',
  target: (fact) => nodeDescriptionRef(fact.nodeId),
  previousValue: (fact) => JSON.stringify(fact.previous),
  knowers: (fact, changes, roadmap) => canOpenNode(fact.nodeId, changes, roadmap),
  audience: (fact, changes, roadmap) => canOpenNode(fact.nodeId, changes, roadmap),
  async current(target, roadmap) {
    const node = target.nodeId ? await roadmap.node(target.nodeId) : null;
    return node
      ? {
          value: JSON.stringify(node.description),
          visible: node.isVisible,
          context: { nodeTitle: node.title },
        }
      : null;
  },
  async entryValues(roadmap, recipientId, known) {
    const accessible = await roadmap.accessibleNodeIds(recipientId);
    const knownKeys = new Set(known.map(({ targetKey }) => targetKey));
    return (await roadmap.nodes()).flatMap((node) => {
      const target = nodeDescriptionRef(node.id);
      // A blocked recipient never saw the description, unless it already knew one.
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
