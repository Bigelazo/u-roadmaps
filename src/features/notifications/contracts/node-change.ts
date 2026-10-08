import type { NodeAccessState } from '@/shared/node-access';

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
    changeKind:
      'node-available' | 'node-updated' | 'node-retired' | 'node-deleted' | 'node-blocked';
    changedFields: readonly ('title' | 'description' | 'nodeType')[];
    contentTarget?: 'access';
    previousValue?: string;
    previousAccess?: NodeAccessState;
    nodeTypeName?: string;
    targetKind?: 'node' | 'roadmap';
  }>;
