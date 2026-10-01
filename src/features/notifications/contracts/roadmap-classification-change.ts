import type { RoadmapAvailabilityRecipient } from './roadmap-availability';

export type RoadmapClassificationChangeNotice = Readonly<{
  eventId: string;
  roadmapId: string;
  courseOfferingId: string;
  courseCode: string;
  year: number;
  semester: number;
  previousTypeName: string;
  nextTypeName: string;
  actorId: string;
  actorName: string;
  occurredAt: Date;
  recipients: readonly RoadmapAvailabilityRecipient[];
}>;
