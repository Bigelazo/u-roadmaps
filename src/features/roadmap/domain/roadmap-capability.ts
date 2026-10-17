import {
  positionCapabilities,
  type InstitutionalCoursePosition,
} from '@/shared/institutional-position';

/**
 * What a participant asks to do with a Roadmap:
 * - `read`: see it as a participant (any active Participation);
 * - `oversee`: see a teaching view of it, such as the Canvas preview or Student progress
 *   tracking (active teaching staff);
 * - `complete`: record a Completion (active students; observers hold the student role);
 * - `edit`: change it, including Canvas preview progress (active teaching staff).
 *
 * Edit and Completion follow the Participation role, never the Institutional course
 * position, so legacy Participations with an unknown position keep their rights.
 */
export type RoadmapCapability = 'read' | 'oversee' | 'complete' | 'edit';

export type RoadmapRefusal = 'ROADMAP_NOT_FOUND' | 'FORBIDDEN' | 'ROADMAP_CLOSED';

export type RoadmapRejection<Reason extends RoadmapRefusal = RoadmapRefusal> = {
  kind: 'REJECTED';
  reason: Reason;
};

export type CapabilityParticipation = { role: 'STUDENT' | 'TEACHER'; isActive: boolean };
export type CapabilityRoadmap = { closedAt: Date | null };

const CAPABILITY_ROLES: Readonly<Record<RoadmapCapability, readonly ('STUDENT' | 'TEACHER')[]>> = {
  read: ['STUDENT', 'TEACHER'],
  oversee: ['TEACHER'],
  complete: ['STUDENT'],
  edit: ['TEACHER'],
};

/** Capabilities that change the Roadmap, which a Roadmap closure refuses. */
const CHANGES_ROADMAP: Readonly<Record<RoadmapCapability, boolean>> = {
  read: false,
  oversee: false,
  complete: true,
  edit: true,
};

/** Whether a Participation's role and activity grant `capability`, regardless of the Roadmap. */
export function participationGrants(
  participation: CapabilityParticipation | null,
  capability: RoadmapCapability,
) {
  return (
    participation?.isActive === true && CAPABILITY_ROLES[capability].includes(participation.role)
  );
}

/**
 * The one decision behind every participant's access to a Roadmap. The refusals keep their
 * precedence: forbidden, then not found, then closed. On success it returns the
 * Participation and Roadmap it decided over, so callers no longer handle their absence.
 */
export function decideRoadmapCapability<
  Participation extends CapabilityParticipation,
  Roadmap extends CapabilityRoadmap,
>({
  capability,
  participation,
  roadmap,
}: {
  capability: RoadmapCapability;
  participation: Participation | null;
  roadmap: Roadmap | null;
}): { kind: 'ALLOWED'; participation: Participation; roadmap: Roadmap } | RoadmapRejection {
  if (!participation || !participationGrants(participation, capability))
    return { kind: 'REJECTED', reason: 'FORBIDDEN' };
  if (!roadmap) return { kind: 'REJECTED', reason: 'ROADMAP_NOT_FOUND' };
  if (roadmap.closedAt && CHANGES_ROADMAP[capability])
    return { kind: 'REJECTED', reason: 'ROADMAP_CLOSED' };
  return { kind: 'ALLOWED', participation, roadmap };
}

/**
 * Only the course professor creates the Roadmap. A complete U-Campus `report` decides alone;
 * without one (an outage or a partial report), an active stored Participation whose
 * Institutional course position is course professor may create it. Unknown positions never do.
 */
export function decideRoadmapCreation({
  report,
  participation,
}: {
  /** The effective position U-Campus reports, or `null` when it cannot report completely. */
  report: { position: InstitutionalCoursePosition | null } | null;
  participation: {
    isActive: boolean;
    institutionalPosition: InstitutionalCoursePosition | null;
  } | null;
}): { kind: 'ALLOWED' } | RoadmapRejection<'FORBIDDEN'> {
  const position = report
    ? report.position
    : participation?.isActive
      ? participation.institutionalPosition
      : null;
  return positionCapabilities(position).canCreateRoadmap
    ? { kind: 'ALLOWED' }
    : { kind: 'REJECTED', reason: 'FORBIDDEN' };
}
