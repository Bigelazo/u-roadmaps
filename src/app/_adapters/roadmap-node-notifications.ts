import { deliverNodeChange, type NoticeDeliveryScheduler } from '@/features/notifications/server';
import type { CourseOfferingIdentifier } from '@/features/roadmap';
import type { NodeNotificationDescriptor } from '@/features/roadmap/server';

export async function deliverRoadmapNodeNotifications(
  {
    actorId,
    identifier,
    notifications,
  }: {
    actorId: string;
    identifier: CourseOfferingIdentifier;
    notifications: readonly NodeNotificationDescriptor[];
  },
  scheduleDelivery?: NoticeDeliveryScheduler,
) {
  await Promise.all(
    notifications.map((notification) =>
      deliverNodeChange(
        {
          userId: actorId,
          ...identifier,
          nodeId: notification.nodeId,
          roadmapId: notification.roadmapId,
          ...(notification.eventId ? { eventId: notification.eventId } : {}),
          changeKind: notification.changeKind,
          changedFields: [],
          previousAccess: notification.previousAccess,
          nodeTitle: notification.nodeTitle,
          nodeTypeName: notification.nodeTypeName,
          recipientIds: notification.recipientIds,
          targetKind: notification.targetKind,
        },
        ...(scheduleDelivery ? [scheduleDelivery] : []),
      ).catch(() => undefined),
    ),
  );
}
