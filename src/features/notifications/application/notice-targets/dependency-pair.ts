import { NOTICE_TARGET } from './kinds';
import { ABSENT, PRESENT } from '../absorption';
import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import { dependencyTarget } from '@/shared/route-notice-target';
import {
  isNodeViewer,
  nodePart,
  nodeViewers,
  type NoticeTargetDescriptor,
  type NoticeTargetRef,
  type RoadmapView,
} from './descriptor';

export const dependencyPairRef = (sourceNodeId: string, targetNodeId: string) => ({
  noticeTarget: NOTICE_TARGET.dependency,
  targetKey: dependencyTarget(sourceNodeId, targetNodeId),
  nodeId: null,
});

const pairValue = (exists: boolean) => (exists ? PRESENT : ABSENT);

type DependencyFact = Extract<RoadmapChangeFact, { kind: 'dependency' }>;

function dependencyPair({ targetKey }: NoticeTargetRef) {
  const [, sourceNodeId, targetNodeId] = targetKey.split(':');
  return { sourceNodeId, targetNodeId };
}

async function pairRecipients(
  fact: DependencyFact,
  _changes: RoadmapChanges,
  roadmap: RoadmapView,
) {
  return nodeViewers(fact.sourceNode.isVisible && fact.targetNode.isVisible, roadmap);
}

export const dependencyPairTarget: NoticeTargetDescriptor<DependencyFact> = {
  noticeTarget: NOTICE_TARGET.dependency,
  noticeClass: 'roadmap-path-changed',
  shownTo: 'dependency-viewers',
  matches: (fact): fact is DependencyFact => fact.kind === 'dependency',
  target: (fact) => dependencyPairRef(fact.sourceNodeId, fact.targetNodeId),
  previousValue: (fact) => pairValue(fact.previous),
  knowers: pairRecipients,
  audience: pairRecipients,
  async current(target, roadmap, recipientId) {
    const { sourceNodeId, targetNodeId } = dependencyPair(target);
    const [source, dependent] = await Promise.all([
      roadmap.node(sourceNodeId),
      roadmap.node(targetNodeId),
    ]);
    if (!source || !dependent) return null;
    const dependency = await roadmap.dependency(sourceNodeId, targetNodeId);
    return {
      value: pairValue(!!dependency),
      visible: await isNodeViewer(source.isVisible && dependent.isVisible, recipientId, roadmap),
      context: {
        prerequisiteNodeTitle: source.title,
        dependentNodeTitle: dependent.title,
        ...(dependency ? { dependencyId: dependency.id } : {}),
      },
    };
  },
  async entryValues(roadmap, _recipientId, known) {
    const pairs = (await roadmap.dependencies()).map(({ sourceNodeId, targetNodeId }) =>
      dependencyPairRef(sourceNodeId, targetNodeId),
    );
    const present = new Set(pairs.map(({ targetKey }) => targetKey));
    return [
      ...pairs.map((target) => ({ target, currentValue: PRESENT })),
      ...known
        .filter(({ targetKey }) => !present.has(targetKey))
        .map((target) => ({ target, currentValue: ABSENT })),
    ];
  },
  factContext: (fact) => ({ dependencyId: fact.dependencyId }),
  storedData: dependencyPair,
  wording: ({ currentValue, context }) => {
    const dependent = String(context.dependentNodeTitle);
    const prerequisite = String(context.prerequisiteNodeTitle);
    const relation = currentValue === PRESENT ? 'ahora requiere' : 'ya no requiere';
    return {
      subject: 'Ruta actualizada',
      body: `«${dependent}» ${relation} «${prerequisite}».`,
      summaryGroup: 'general',
      summaryParts: [
        nodePart(dependent, 'targetNodeId'),
        ` ${relation} `,
        nodePart(prerequisite, 'sourceNodeId'),
        '.',
      ],
    };
  },
  apiData: ({ context }) => ({
    dependencyId: context.dependencyId,
    prerequisiteNodeTitle: context.prerequisiteNodeTitle,
    dependentNodeTitle: context.dependentNodeTitle,
  }),
};
