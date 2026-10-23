import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import { nodeTypeNameTarget } from '@/shared/route-notice-target';
import {
  participantIds,
  type NoticeTargetDescriptor,
  type NoticeTargetRef,
  type RoadmapView,
} from './descriptor';

export const typeNameRef = (nodeTypeId: string) => ({
  noticeTarget: NOTICE_TARGET.nodeTypeName,
  targetKey: nodeTypeNameTarget(nodeTypeId),
  nodeId: null,
});

type NodeTypeNameFact = Extract<RoadmapChangeFact, { kind: 'node-type-name' }>;

const nodeTypeId = ({ targetKey }: NoticeTargetRef) => targetKey.split(':')[1];

async function typeRecipients(
  fact: NodeTypeNameFact,
  _changes: RoadmapChanges,
  roadmap: RoadmapView,
) {
  if (!(await roadmap.nodeType(fact.nodeTypeId))?.hasVisibleNode) return [];
  return participantIds(roadmap);
}

export const typeNameTarget: NoticeTargetDescriptor<NodeTypeNameFact> = {
  noticeTarget: NOTICE_TARGET.nodeTypeName,
  noticeClass: 'roadmap-classification-changed',
  shownTo: 'node-type-viewers',
  matches: (fact): fact is NodeTypeNameFact => fact.kind === 'node-type-name',
  target: (fact) => typeNameRef(fact.nodeTypeId),
  previousValue: (fact) => fact.previous,
  knowers: typeRecipients,
  audience: typeRecipients,
  async current(target, roadmap) {
    const type = await roadmap.nodeType(nodeTypeId(target));
    return type ? { value: type.name, visible: type.hasVisibleNode } : null;
  },
  entryValues: async (roadmap) =>
    (await roadmap.nodeTypes()).map((type) => ({
      target: typeNameRef(type.id),
      currentValue: type.name,
    })),
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
