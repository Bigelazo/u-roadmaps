import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import { ABSENT, PRESENT, nodeDeletionRef } from '../absorption';
import type { NoticeTargetDescriptor, TargetValues } from './descriptor';

type NodeDeletedFact = Extract<RoadmapChangeFact, { kind: 'node-deleted' }>;

function nodeTitle({ context }: TargetValues) {
  return String(context.nodeTitle ?? '');
}

/**
 * Node deletion: a broad target that replaces the pending notices about its Node. A
 * deleted Node never changes again, so no Known value is kept: recognizing it is final.
 */
export const nodeDeletionTarget: NoticeTargetDescriptor<NodeDeletedFact> = {
  noticeTarget: NOTICE_TARGET.nodeDeletion,
  noticeClass: 'roadmap-node-changed',
  readSide: { changeKind: 'node-deleted', changedFields: [], targetKind: 'roadmap' },
  scope: 'node',
  keepsKnownValue: false,
  matches: (fact): fact is NodeDeletedFact => fact.kind === 'node-deleted',
  target: (fact) => nodeDeletionRef(fact.nodeId),
  previousValue: () => PRESENT,
  knowers: async () => [],
  // Deleting a hidden Node is not news: nobody saw it last.
  async audience(fact, _changes, roadmap) {
    if (!fact.previous.isVisible) return [];
    return (await roadmap.participants()).map(({ userId }) => userId);
  },
  async current(target, roadmap) {
    const node = target.nodeId ? await roadmap.node(target.nodeId) : null;
    return { value: node ? PRESENT : ABSENT, visible: true };
  },
  factContext: (fact) => ({ nodeTitle: fact.previous.title, nodeTypeName: fact.nodeTypeName }),
  wording: (values) => ({
    subject: nodeTitle(values),
    body: `Nodo eliminado: «${nodeTitle(values)}».`,
    summaryGroup: 'node',
    summary: 'Nodo eliminado.',
  }),
  apiData: ({ context }) => ({
    nodeTitle: nodeTitle({ context } as TargetValues),
    nodeTypeName: context.nodeTypeName,
  }),
};
