import {
  accessNoticeDestination,
  nodeAccessChangeText,
  nodeAccessState,
} from '@/shared/node-access';
import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import type { NoticeTargetDescriptor, TargetValues } from './descriptor';

type NodeAccessFact = Extract<RoadmapChangeFact, { kind: 'node-access' }>;

export const nodeAccessRef = (nodeId: string) => ({
  noticeTarget: 'node-access',
  targetKey: `node:${nodeId}:access`,
  nodeId,
});

function nodeTitle({ context }: TargetValues) {
  return String(context.nodeTitle ?? '');
}

/**
 * Node access: Disponible / Bloqueado / Retirado per recipient. Roadmap reports one
 * transition per recipient whose state changed; the state at edit time is recorded as
 * the current value, so deferred delivery compares against it (not the live Roadmap).
 * Hidden Nodes still get notices: Retirado is itself the news.
 */
export const nodeAccessTarget: NoticeTargetDescriptor<NodeAccessFact> = {
  noticeTarget: 'node-access',
  noticeClass: 'roadmap-node-changed',
  readSide: { changeKind: 'node-available', changedFields: ['access'], targetKind: 'node' },
  valueReadSide: ({ currentValue }) => accessNoticeDestination(currentValue),
  matches: (fact): fact is NodeAccessFact => fact.kind === 'node-access',
  target: (fact) => nodeAccessRef(fact.nodeId),
  previousValue: (fact) => fact.previous,
  knowers: async (fact) => [fact.recipientId],
  audience: async (fact) => [fact.recipientId],
  currentAtEdit: (fact) => ({ recipientIds: [fact.recipientId], value: fact.current }),
  async current(target, roadmap) {
    const node = target.nodeId ? await roadmap.node(target.nodeId) : null;
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
