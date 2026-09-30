import { deliverNodeChange } from '@/features/notifications/server';
import type { CourseOfferingIdentifier } from '@/features/roadmap';
import type { NodeNotificationDescriptor } from '@/features/roadmap/server';

export async function deliverRoadmapNodeNotifications({
  actorId,
  identifier,
  notifications,
}: {
  actorId: string;
  identifier: CourseOfferingIdentifier;
  notifications: readonly NodeNotificationDescriptor[];
}) {
  for (const notification of notifications) {
    await deliverNodeChange({
      userId: actorId,
      ...identifier,
      nodeId: notification.nodeId,
      roadmapId: notification.roadmapId,
      changeKind: notification.changeKind,
      changedFields: [],
      nodeTitle: notification.nodeTitle,
      nodeTypeName: notification.nodeTypeName,
      recipientIds: notification.recipientIds,
      targetKind: notification.targetKind,
    }).catch(() => undefined);
  }
}
