import 'server-only';

import { prisma } from '@/shared/server/db';
import type { RoadmapAvailabilityNotice } from './contracts';
import { emitRoadmapAvailability } from './application/emit-roadmap-availability';
import { novuTransport } from './infrastructure/novu-transport';
import { createSubscriberHash } from './infrastructure/subscriber-hash';

export type InboxIdentity = Readonly<{
  subscriber: string;
  subscriberHash: string;
  applicationIdentifier: string;
  apiUrl?: string;
  socketUrl?: string;
}>;

export function notificationsEnabled() {
  return (
    process.env.NOVU_NOTIFICATIONS_ENABLED === 'true' &&
    (process.env.NODE_ENV !== 'production' || process.env.NOVU_PRODUCTION_APPROVED === 'true')
  );
}

export function getInboxIdentity(userId: string): InboxIdentity | null {
  const applicationIdentifier = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;
  const secretKey = process.env.NOVU_SECRET_KEY;
  if (!notificationsEnabled() || !applicationIdentifier || !secretKey) return null;

  return {
    subscriber: userId,
    subscriberHash: createSubscriberHash(userId, secretKey),
    applicationIdentifier,
    ...(process.env.NEXT_PUBLIC_NOVU_API_URL
      ? { apiUrl: process.env.NEXT_PUBLIC_NOVU_API_URL }
      : {}),
    ...(process.env.NEXT_PUBLIC_NOVU_SOCKET_URL
      ? { socketUrl: process.env.NEXT_PUBLIC_NOVU_SOCKET_URL }
      : {}),
  };
}

export async function deliverRoadmapAvailability(notice: RoadmapAvailabilityNotice) {
  const workflowId = process.env.NOVU_WORKFLOW_ROADMAP_AVAILABLE;
  if (!notificationsEnabled() || !workflowId) return;

  await emitRoadmapAvailability(
    notice,
    novuTransport,
    async (userIds) => {
      const active = await prisma.participation.findMany({
        where: {
          courseOfferingId: notice.courseOfferingId,
          userId: { in: [...userIds] },
          isActive: true,
        },
        select: { userId: true },
      });
      return active.map(({ userId }) => userId);
    },
    workflowId,
  ).catch(() => {
    // Novu is best-effort: delivery cannot change the committed mutation result.
  });
}
