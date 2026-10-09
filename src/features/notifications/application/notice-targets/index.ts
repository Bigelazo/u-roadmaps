import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import type {
  NoticeTargetDescriptor,
  TargetContext,
  TargetValues,
  TargetWording,
} from './descriptor';
import { nodeTitleTarget } from './node-title';
import { nodeDescriptionTarget } from './node-description';
import { nodeTypeTarget } from './node-type';
import { resourceTarget } from './resource';
import { dependencyPairTarget } from './dependency-pair';
import { typeNameTarget } from './node-type-name';
import { nodeAccessTarget } from './node-access';
import { nodeCreationTarget } from './node-creation';
import { nodeDeletionTarget } from './node-deletion';
import { roadmapAvailabilityTarget } from './roadmap-availability';

export type {
  EntryValue,
  KnownTarget,
  NoticeReadSide,
  NoticeTargetDescriptor,
  NoticeTargetRef,
  RoadmapView,
  RoadmapViewDependency,
  RoadmapViewNode,
  RoadmapViewNodeType,
  RoadmapViewResource,
  TargetContext,
  TargetCurrent,
  TargetValues,
  TargetWording,
} from './descriptor';

/** Every Notice target kind handled by the notice lifecycle module (ADR-0024). */
export const noticeTargetDescriptors: readonly NoticeTargetDescriptor[] = [
  nodeTitleTarget,
  nodeDescriptionTarget,
  nodeTypeTarget,
  resourceTarget,
  dependencyPairTarget,
  typeNameTarget,
  nodeAccessTarget,
  nodeCreationTarget,
  nodeDeletionTarget,
  roadmapAvailabilityTarget,
];

export function descriptorForFact(fact: RoadmapChangeFact) {
  return noticeTargetDescriptors.find((descriptor) => descriptor.matches(fact)) ?? null;
}

/** The descriptor of a Notice target kind; null for a kind no descriptor owns. */
export function descriptorForNoticeTarget(noticeTarget: unknown) {
  return (
    noticeTargetDescriptors.find((descriptor) => descriptor.noticeTarget === noticeTarget) ?? null
  );
}

/** The descriptor and stored values of a lifecycle notice; null for any other notice row. */
export function storedTargetValues(
  data: unknown,
): { descriptor: NoticeTargetDescriptor; values: TargetValues } | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const descriptor = descriptorForNoticeTarget(record.noticeTarget);
  if (
    !descriptor ||
    typeof record.knownValue !== 'string' ||
    typeof record.currentValue !== 'string'
  )
    return null;
  return {
    descriptor,
    values: {
      knownValue: record.knownValue,
      currentValue: record.currentValue,
      context: targetContext(record.context),
      knownContext: targetContext(record.knownContext),
    },
  };
}

export function targetContext(value: unknown): TargetContext {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Attribution label of a stored notice: an attributed actor without a name is teaching staff. */
export function noticeActorLabel(data: unknown): { actorName?: string } {
  if (!data || typeof data !== 'object') return {};
  const { actorId, actorName } = data as { actorId?: unknown; actorName?: unknown };
  if (typeof actorName === 'string') return { actorName };
  return typeof actorId === 'string' ? { actorName: 'Equipo docente' } : {};
}

/**
 * Read-time projection of a lifecycle notice: its text and API data come from the
 * descriptor, so wording changes need no migration. Other rows keep their stored text.
 * `live` overrides stored presentation context (e.g. the current Node title).
 */
export function projectTargetNotice<D>(
  data: D,
  live: TargetContext = {},
): { data: D; wording: TargetWording } | null {
  const stored = storedTargetValues(data);
  if (!stored) return null;
  const values = { ...stored.values, context: { ...stored.values.context, ...live } };
  return {
    data: {
      ...(data as object),
      ...noticeActorLabel(data),
      ...stored.descriptor.apiData(values),
    } as D,
    wording: stored.descriptor.wording(values),
  };
}
