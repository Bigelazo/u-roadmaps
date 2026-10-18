import { NOTICE_TARGET } from './kinds';
import { ABSENT, PRESENT } from '../absorption';
import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import { dependencyTarget } from '@/shared/route-notice-target';
import {
  isNodeViewer,
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

/** A Dependency pair's value: whether the requirement exists. */
const pairValue = (exists: boolean) => (exists ? PRESENT : ABSENT);

type DependencyFact = Extract<RoadmapChangeFact, { kind: 'dependency' }>;

/** The ordered (prerequisite, dependent) pair a `dependency:<source>:<target>` key names. */
function dependencyPair({ targetKey }: NoticeTargetRef) {
  const [, sourceNodeId, targetNodeId] = targetKey.split(':');
  return { sourceNodeId, targetNodeId };
}

/**
 * Everyone when the Dependency joins two visible Nodes; teaching staff always
 * (ADR-0014 decision 14.5).
 */
async function pairRecipients(
  fact: DependencyFact,
  _changes: RoadmapChanges,
  roadmap: RoadmapView,
) {
  // Removals caused by hiding or deleting a Node are not reported as Dependency facts.
  return nodeViewers(fact.sourceNode.isVisible && fact.targetNode.isVisible, roadmap);
}

/**
 * Dependency pair: keyed by the ordered pair of Nodes, not the Dependency id, so removing
 * and re-adding the same requirement nets to nothing and a reversal is another target.
 * Everyone is told, whatever their own Completions (ADR-0014 decision 10).
 */
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
      // A known requirement that is gone is shown as removed.
      ...known
        .filter(({ targetKey }) => !present.has(targetKey))
        .map((target) => ({ target, currentValue: ABSENT })),
    ];
  },
  factContext: (fact) => ({ dependencyId: fact.dependencyId }),
  storedData: dependencyPair,
  wording: ({ currentValue, context }) => ({
    subject: 'Ruta actualizada',
    body: `«${String(context.dependentNodeTitle)}» ${currentValue === PRESENT ? 'ahora requiere' : 'ya no requiere'} «${String(context.prerequisiteNodeTitle)}».`,
    summaryGroup: 'general',
  }),
  apiData: ({ context }) => ({
    dependencyId: context.dependencyId,
    prerequisiteNodeTitle: context.prerequisiteNodeTitle,
    dependentNodeTitle: context.dependentNodeTitle,
  }),
};
