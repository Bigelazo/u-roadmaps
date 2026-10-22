import { NOTICE_TARGET } from './kinds';
import { nodeAccessChangeText, nodeAccessState } from '@/shared/node-access';
import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import { type NoticeTargetDescriptor, type TargetValues } from './descriptor';

type NodeAccessFact = Extract<RoadmapChangeFact, { kind: 'node-access' }>;

export const nodeAccessRef = (nodeId: string) => ({
  noticeTarget: NOTICE_TARGET.nodeAccess,
  targetKey: `node:${nodeId}:access`,
  nodeId,
});

function nodeTitle({ context }: TargetValues) {
  return String(context.nodeTitle ?? '');
}

export const nodeAccessTarget: NoticeTargetDescriptor<NodeAccessFact> = {
  noticeTarget: NOTICE_TARGET.nodeAccess,
  noticeClass: 'roadmap-node-changed',
  shownTo: 'everyone',
  matches: (fact): fact is NodeAccessFact => fact.kind === 'node-access',
  target: (fact) => nodeAccessRef(fact.nodeId),
  previousValue: (fact) => fact.previous,
  knowers: async (fact) => [fact.recipientId],
  audience: async (fact) => [fact.recipientId],
  currentAtEdit: (fact) => ({ recipientIds: [fact.recipientId], value: fact.current }),
  async current(target, roadmap) {
    const node = await (target.nodeId ? roadmap.node(target.nodeId) : null);
    return node ? { value: '', visible: true, context: { nodeTitle: node.title } } : null;
  },
  async entryValues(roadmap, recipientId) {
    const accessible = await roadmap.accessibleNodeIds(recipientId);
    return (await roadmap.nodes()).map((node) => ({
      target: nodeAccessRef(node.id),
      currentValue: nodeAccessState(node.isVisible, accessible.has(node.id)),
    }));
  },
  wording: (values) => ({
    subject: nodeTitle(values),
    body: nodeAccessChangeText(nodeTitle(values), values.knownValue, values.currentValue),
    summaryGroup: 'node',
  }),
  apiData: (values) => ({ nodeTitle: nodeTitle(values) }),
};
