export type NodeChangeRecipient = Readonly<{ userId: string; name: string }>;

type NodeScopedNotice = Readonly<{
  eventId: string;
  roadmapId: string;
  courseOfferingId: string;
  courseCode: string;
  year: number;
  semester: number;
  courseName: string;
  nodeId: string;
  nodeTitle: string;
  actorId: string;
  actorName: string;
  occurredAt: Date;
  recipients: readonly NodeChangeRecipient[];
}>;

export type NodeChangeNotice = NodeScopedNotice &
  Readonly<{
    changeKind: 'node-available' | 'node-updated';
    changedFields: readonly ('title' | 'description' | 'nodeType')[];
  }>;

export type ResourceChangeNotice = NodeScopedNotice &
  Readonly<{
    changeKind: 'resource-added' | 'resource-updated' | 'resource-removed';
    resourceTitle: string;
  }>;
