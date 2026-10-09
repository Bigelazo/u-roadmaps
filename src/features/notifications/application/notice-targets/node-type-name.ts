import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import { nodeTypeNameTarget } from '@/shared/route-notice-target';
import type { NoticeTargetDescriptor, NoticeTargetRef, RoadmapView } from './descriptor';

type NodeTypeNameFact = Extract<RoadmapChangeFact, { kind: 'node-type-name' }>;

/** The Node type a `node-type:<id>:name` key names. */
const nodeTypeId = ({ targetKey }: NoticeTargetRef) => targetKey.split(':')[1];

/** Everyone, when the type has at least one visible Node. */
async function typeRecipients(
  fact: NodeTypeNameFact,
  _changes: RoadmapChanges,
  roadmap: RoadmapView,
) {
  if (!(await roadmap.nodeType(fact.nodeTypeId))?.hasVisibleNode) return [];
  return (await roadmap.participants()).map(({ userId }) => userId);
}

/**
 * Node type name: each type is its own target, and only its name; icon and color edits
 * report nothing. Compared from the known name (ADR-0014 decision 1).
 */
export const typeNameTarget: NoticeTargetDescriptor<NodeTypeNameFact> = {
  noticeTarget: 'node-type-name',
  noticeClass: 'roadmap-classification-changed',
  readSide: { changeKind: 'classification-updated', changedFields: [], targetKind: 'roadmap' },
  matches: (fact): fact is NodeTypeNameFact => fact.kind === 'node-type-name',
  target: (fact) => ({ targetKey: nodeTypeNameTarget(fact.nodeTypeId), nodeId: null }),
  previousValue: (fact) => fact.previous,
  knowers: typeRecipients,
  audience: typeRecipients,
  async current(target, roadmap) {
    const type = await roadmap.nodeType(nodeTypeId(target));
    return type ? { value: type.name, visible: type.hasVisibleNode } : null;
  },
  storedData: (target) => ({ nodeTypeId: nodeTypeId(target) }),
  wording: ({ knownValue, currentValue }) => ({
    subject: `Tipo «${knownValue}» → «${currentValue}»`,
    body: `El tipo «${knownValue}» ahora se llama «${currentValue}».`,
    summaryGroup: 'general',
  }),
  apiData: ({ knownValue, currentValue }) => ({
    previousTypeName: knownValue,
    nextTypeName: currentValue,
  }),
};
