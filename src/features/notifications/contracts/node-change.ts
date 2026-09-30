export type NodeChangeRecipient = Readonly<{ userId: string; name: string }>;

export type NodeChangeNotice = Readonly<{
  eventId: string;
  roadmapId: string;
  courseOfferingId: string;
  courseCode: string;
  year: number;
  semester: number;
  courseName: string;
  nodeId: string;
  nodeTitle: string;
  changeKind: 'node-available' | 'node-updated';
  changedFields: readonly ('title' | 'description' | 'nodeType')[];
  actorId: string;
  actorName: string;
  occurredAt: Date;
  recipients: readonly NodeChangeRecipient[];
}>;
