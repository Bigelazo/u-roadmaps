import { NOTICE_TARGET } from './notice-targets/kinds';
import type { NoticeTargetRef } from './notice-targets/descriptor';

export const ABSENT = 'absent';
export const PRESENT = 'present';

export function availabilityRef(roadmapId: string): NoticeTargetRef {
  return {
    noticeTarget: NOTICE_TARGET.roadmapAvailability,
    targetKey: `roadmap:${roadmapId}:availability`,
    nodeId: null,
  };
}

export function nodeCreationRef(nodeId: string): NoticeTargetRef {
  return { noticeTarget: NOTICE_TARGET.nodeCreation, targetKey: `node:${nodeId}:creation`, nodeId };
}

export function nodeDeletionRef(nodeId: string): NoticeTargetRef {
  return { noticeTarget: NOTICE_TARGET.nodeDeletion, targetKey: `node:${nodeId}:deletion`, nodeId };
}

export function containingTargets(roadmapId: string, target: NoticeTargetRef): NoticeTargetRef[] {
  return [
    availabilityRef(roadmapId),
    ...(target.nodeId ? [nodeCreationRef(target.nodeId)] : []),
  ].filter(({ targetKey }) => targetKey !== target.targetKey);
}

export function absorbs(knownValue: string | null | undefined) {
  return knownValue === ABSENT;
}
