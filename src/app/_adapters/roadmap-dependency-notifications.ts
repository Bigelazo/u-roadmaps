import { deliverRoadmapPathChange } from '@/features/notifications/server';
import type { CourseOfferingIdentifier } from '@/features/roadmap';
import type { DependencyNotificationBatch } from '@/features/roadmap/server';
import { deliverRoadmapNodeNotifications } from './roadmap-node-notifications';

export async function deliverRoadmapDependencyNotifications({
  actorId,
  identifier,
  notifications,
}: {
  actorId: string;
  identifier: CourseOfferingIdentifier;
  notifications: DependencyNotificationBatch;
}) {
  if (notifications.path) {
    await deliverRoadmapPathChange({
      userId: actorId,
      identifier,
      ...notifications.path,
    }).catch(() => undefined);
  }

  await deliverRoadmapNodeNotifications({
    actorId,
    identifier,
    notifications: notifications.nodes,
  });
}
