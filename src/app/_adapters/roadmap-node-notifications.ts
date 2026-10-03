import { deliverNodeChange } from '@/features/notifications/server';
import type { CourseOfferingIdentifier } from '@/features/roadmap';
import type { NodeNotificationDescriptor } from '@/features/roadmap/server';

export async function deliverRoadmapNodeNotifications({
  actorId,
  identifier,
  notifications,
  publishedNodeId,
}: {
  actorId: string;
  identifier: CourseOfferingIdentifier;
  notifications: readonly NodeNotificationDescriptor[];
  publishedNodeId?: string;
}) {
  for (const notification of notifications) {
    await deliverNodeChange({
      userId: actorId,
      ...identifier,
      nodeId: notification.nodeId,
      roadmapId: notification.roadmapId,
      ...(notification.eventId ? { eventId: notification.eventId } : {}),
      changeKind: notification.changeKind,
      changedFields: [],
      nodeTitle: notification.nodeTitle,
      nodeTypeName: notification.nodeTypeName,
      recipientIds: notification.recipientIds,
      targetKind: notification.targetKind,
      ...(notification.nodeId === publishedNodeId && notification.changeKind === 'node-available'
        ? { availabilitySource: 'publication' as const }
        : {}),
    }).catch(() => undefined);
  }
}
