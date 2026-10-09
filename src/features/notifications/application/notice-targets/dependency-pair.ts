import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import { dependencyTarget } from '@/shared/route-notice-target';
import type { NoticeTargetDescriptor, NoticeTargetRef, RoadmapView } from './descriptor';

export const dependencyPairRef = (sourceNodeId: string, targetNodeId: string) => ({
  noticeTarget: NOTICE_TARGET.dependency,
  targetKey: dependencyTarget(sourceNodeId, targetNodeId),
  nodeId: null,
});

type DependencyFact = Extract<RoadmapChangeFact, { kind: 'dependency' }>;

/** The ordered (prerequisite, dependent) pair a `dependency:<source>:<target>` key names. */
function dependencyPair({ targetKey }: NoticeTargetRef) {
  const [, sourceNodeId, targetNodeId] = targetKey.split(':');
  return { sourceNodeId, targetNodeId };
}

const changeKind = (currentValue: string) =>
  currentValue === 'true' ? 'dependency-added' : 'dependency-removed';

/** Everyone, when the Dependency joins two visible Nodes. */
async function pairRecipients(
  fact: DependencyFact,
  _changes: RoadmapChanges,
  roadmap: RoadmapView,
) {
  // Removals caused by hiding or deleting a Node are not reported as Dependency facts.
  if (!fact.sourceNode.isVisible || !fact.targetNode.isVisible) return [];
  return (await roadmap.participants()).map(({ userId }) => userId);
}

/**
 * Dependency pair: keyed by the ordered pair of Nodes, not the Dependency id, so removing
 * and re-adding the same requirement nets to nothing and a reversal is another target.
 * Everyone is told, whatever their own Completions (ADR-0014 decision 10).
 */
export const dependencyPairTarget: NoticeTargetDescriptor<DependencyFact> = {
  noticeTarget: NOTICE_TARGET.dependency,
  noticeClass: 'roadmap-path-changed',
  readSide: { changeKind: 'dependency-added', changedFields: [], targetKind: 'roadmap' },
  matches: (fact): fact is DependencyFact => fact.kind === 'dependency',
  target: (fact) => dependencyPairRef(fact.sourceNodeId, fact.targetNodeId),
  previousValue: (fact) => String(fact.previous),
  knowers: pairRecipients,
  audience: pairRecipients,
  async current(target, roadmap) {
    const { sourceNodeId, targetNodeId } = dependencyPair(target);
    const [source, dependent] = await Promise.all([
      roadmap.node(sourceNodeId),
      roadmap.node(targetNodeId),
    ]);
    if (!source || !dependent) return null;
    const dependency = await roadmap.dependency(sourceNodeId, targetNodeId);
    return {
      value: String(!!dependency),
      visible: source.isVisible && dependent.isVisible,
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
      ...pairs.map((target) => ({ target, currentValue: 'true' })),
      // A known requirement that is gone is shown as removed.
      ...known
        .filter(({ targetKey }) => !present.has(targetKey))
        .map((target) => ({ target, currentValue: 'false' })),
    ];
  },
  factContext: (fact) => ({ dependencyId: fact.dependencyId }),
  valueReadSide: ({ currentValue }) => ({ changeKind: changeKind(currentValue) }),
  storedData: dependencyPair,
  wording: ({ currentValue, context }) => ({
    subject: 'Ruta actualizada',
    body: `«${String(context.dependentNodeTitle)}» ${currentValue === 'true' ? 'ahora requiere' : 'ya no requiere'} «${String(context.prerequisiteNodeTitle)}».`,
    summaryGroup: 'general',
  }),
  apiData: ({ currentValue, context }) => ({
    changeKind: changeKind(currentValue),
    dependencyId: context.dependencyId,
    prerequisiteNodeTitle: context.prerequisiteNodeTitle,
    dependentNodeTitle: context.dependentNodeTitle,
  }),
};
