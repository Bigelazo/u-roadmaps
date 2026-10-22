import {
  positionCapabilities,
  type InstitutionalCoursePosition,
} from '@/shared/institutional-position';

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

const CHANGES_ROADMAP: Readonly<Record<RoadmapCapability, boolean>> = {
  read: false,
  oversee: false,
  complete: true,
  edit: true,
};

export function participationGrants<Participation extends CapabilityParticipation>(
  participation: Participation | null,
  capability: RoadmapCapability,
): participation is Participation {
  return (
    participation?.isActive === true && CAPABILITY_ROLES[capability].includes(participation.role)
  );
}

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

export function decideRoadmapCreation({
  report,
  participation,
}: {
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
