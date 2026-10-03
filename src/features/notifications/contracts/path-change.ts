import type { RoadmapAvailabilityRecipient } from './roadmap-availability';

export type RoadmapPathChangeNotice = Readonly<{
  eventId: string;
  dependencyId: string;
  roadmapId: string;
  courseOfferingId: string;
  courseCode: string;
  year: number;
  semester: number;
  changeKind: 'dependency-added' | 'dependency-removed';
  dependentNodeTitle: string;
  prerequisiteNodeTitle: string;
  actorId: string;
  actorName: string;
  occurredAt: Date;
  recipients: readonly RoadmapAvailabilityRecipient[];
}>;
