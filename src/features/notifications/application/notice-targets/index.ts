import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import type { NoticeTargetDescriptor, TargetValues, TargetWording } from './descriptor';
import { nodeTitleTarget } from './node-title';

export type {
  NoticeTargetDescriptor,
  NoticeTargetRef,
  RoadmapView,
  RoadmapViewNode,
  TargetCurrent,
  TargetValues,
  TargetWording,
} from './descriptor';

/** Every Notice target kind handled by the notice lifecycle module (ADR-0024). */
export const noticeTargetDescriptors: readonly NoticeTargetDescriptor[] = [nodeTitleTarget];

export function descriptorForFact(fact: RoadmapChangeFact) {
  return noticeTargetDescriptors.find((descriptor) => descriptor.matches(fact)) ?? null;
}

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
  const context =
    record.context && typeof record.context === 'object' && !Array.isArray(record.context)
      ? (record.context as Record<string, unknown>)
      : {};
  return {
    descriptor,
    values: { knownValue: record.knownValue, currentValue: record.currentValue, context },
  };
}

/**
 * Read-time projection of a lifecycle notice: its text and API data come from the
 * descriptor, so wording changes need no migration. Other rows keep their stored text.
 */
export function projectTargetNotice<D>(data: D): { data: D; wording: TargetWording } | null {
  const stored = storedTargetValues(data);
  if (!stored) return null;
  return {
    data: { ...(data as object), ...stored.descriptor.apiData(stored.values) } as D,
    wording: stored.descriptor.wording(stored.values),
  };
}
