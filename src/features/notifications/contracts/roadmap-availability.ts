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

export type NotificationTransport = Readonly<{
  ensureSubscribers(input: {
    eventId: string;
    recipients: readonly RoadmapAvailabilityRecipient[];
  }): Promise<void>;
  trigger(input: {
    workflowId: string;
    roadmapId: string;
    eventId: string;
    transactionId: string;
    recipients: readonly string[];
    payload: Readonly<Record<string, string | number>>;
  }): Promise<{ retryAfterMs?: number }>;
}>;

export type ActiveRecipientLookup = (userIds: readonly string[]) => Promise<readonly string[]>;

export class NotificationTransportError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'NotificationTransportError';
  }
}
