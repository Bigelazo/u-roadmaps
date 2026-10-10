import { NOTICE_TARGET } from './notice-targets/kinds';
import type { NoticeTargetRef } from './notice-targets/descriptor';

/**
 * The single absorption rule over the target hierarchy Roadmap ⊃ Node ⊃ aspect/Resource
 * (ADR-0024). Broad targets (Roadmap availability, Node creation) have the Known value
 * `absent` until the recipient recognizes them. While a recipient has not recognized a
 * broad target, every later change inside it is told through it: its notice is brought up
 * to date instead of writing a narrower one. A broad notice, once written, replaces the
 * pending notices it contains (Node deletion absorbs earlier narrower ones).
 */
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

/** Broad targets that contain `target`, broadest first (never the target itself). */
export function containingTargets(roadmapId: string, target: NoticeTargetRef): NoticeTargetRef[] {
  return [
    availabilityRef(roadmapId),
    ...(target.nodeId ? [nodeCreationRef(target.nodeId)] : []),
  ].filter(({ targetKey }) => targetKey !== target.targetKey);
}

/** A broad target absorbs later changes for a recipient who has not recognized it. */
export function absorbs(knownValue: string | null | undefined) {
  return knownValue === ABSENT;
}
