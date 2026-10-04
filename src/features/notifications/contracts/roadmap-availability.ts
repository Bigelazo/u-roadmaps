export type RoadmapAvailabilityRecipient = Readonly<{
  userId: string;
  name: string;
}>;

export type RoadmapAvailabilityNotice = Readonly<{
  eventId: string;
  roadmapId: string;
  courseOfferingId: string;
  courseCode: string;
  year: number;
  semester: number;
  courseName: string;
  actorId: string;
  actorName: string;
  occurredAt: Date;
  recipients: readonly RoadmapAvailabilityRecipient[];
}>;
