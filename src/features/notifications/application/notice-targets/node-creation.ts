import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import { ABSENT, PRESENT, absorbs, nodeCreationRef } from '../absorption';
import type { EntryValue, NoticeTargetDescriptor, TargetValues } from './descriptor';

type NodeCreatedFact = Extract<RoadmapChangeFact, { kind: 'node-created' }>;

function presented({ context }: TargetValues) {
  return {
    nodeTitle: String(context.nodeTitle ?? ''),
    blocked: context.nodeAccess === 'Bloqueado',
  };
}

function text(values: TargetValues) {
  const { nodeTitle, blocked } = presented(values);
  const subject = `Nuevo Nodo «${nodeTitle}»`;
  return { subject, body: `${subject}${blocked ? ' (bloqueado)' : ''}.` };
}

/**
 * Node creation: a broad target. Until the recipient recognizes the new Node, every
 * change inside it updates this one notice, which shows the Node as it is now; a
 * hidden or deleted new Node returns to absent.
 */
export const nodeCreationTarget: NoticeTargetDescriptor<NodeCreatedFact> = {
  noticeTarget: 'node-creation',
  noticeClass: 'roadmap-node-changed',
  readSide: { changeKind: 'node-available', changedFields: [], targetKind: 'node' },
  scope: 'node',
  matches: (fact): fact is NodeCreatedFact => fact.kind === 'node-created',
  target: (fact) => nodeCreationRef(fact.nodeId),
  previousValue: () => ABSENT,
  async knowers(_fact, changes, roadmap) {
    return (await roadmap.participants())
      .map(({ userId }) => userId)
      .filter((userId) => userId !== changes.actorId);
  },
  async audience(fact, _changes, roadmap) {
    if (!fact.current.isVisible) return [];
    return (await roadmap.participants()).map(({ userId }) => userId);
  },
  async current(target, roadmap, recipientId) {
    const node = target.nodeId ? await roadmap.node(target.nodeId) : null;
    if (!node) return null;
    if (!node.isVisible) return { value: ABSENT, visible: false };
    const accessible = (await roadmap.accessibleNodeIds(recipientId)).has(node.id);
    const resources = accessible ? await roadmap.nodeResources(node.id) : [];
    return {
      value: PRESENT,
      visible: true,
      context: {
        nodeTitle: node.title,
        nodeDescription: accessible ? node.description : null,
        nodeTypeId: node.nodeTypeId,
        nodeTypeName: node.nodeTypeName,
        nodeAccess: accessible ? 'Disponible' : 'Bloqueado',
        resources: resources.map(({ id, title }) => ({ id, title })),
      },
    };
  },
  async entryValues(roadmap, _recipientId, known) {
    // A visible new Node the recipient has not recognized (even if its notice is on its way).
    const shown: EntryValue[] = [];
    for (const { nodeId, knownValue } of known) {
      const node = nodeId && absorbs(knownValue) ? await roadmap.node(nodeId) : null;
      if (node?.isVisible)
        shown.push({
          target: nodeCreationRef(node.id),
          currentValue: PRESENT,
          context: { nodeTitle: node.title },
        });
    }
    return shown;
  },
  wording: (values) => ({ ...text(values), summaryGroup: 'node', summary: text(values).body }),
  apiData: ({ context }) => ({
    nodeTitle: context.nodeTitle,
    nodeDescription: context.nodeDescription ?? null,
    nodeTypeId: context.nodeTypeId,
    nodeTypeName: context.nodeTypeName,
    nodeAccess: context.nodeAccess,
    resources: context.resources ?? [],
  }),
};
