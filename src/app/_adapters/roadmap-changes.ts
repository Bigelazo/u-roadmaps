import 'server-only';
import { after } from 'next/server';
import type { Prisma } from '@/shared/server/db';
import { accessNoticeDestination } from '@/shared/node-access';
import type {
  RoadmapChangePort,
  RoadmapChanges,
  RoadmapChangeFact,
} from '@/features/roadmap/server';
import {
  deliverNodeChange,
  deliverRoadmapAvailability,
  recordRoadmapNotices,
  type NoticeDeliveryScheduler,
} from '@/features/notifications/server';

async function activeRecipientIds(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
): Promise<string[]> {
  const participants = await transaction.participation.findMany({
    where: { courseOffering: { roadmap: { id: roadmapId } }, isActive: true },
    select: { userId: true },
  });
  return participants.map(({ userId }) => userId);
}

type PreparedFact = Readonly<{
  fact: RoadmapChangeFact;
  recipientIds?: readonly string[];
}>;

async function prepareDeliveryContext(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
): Promise<PreparedFact[]> {
  return Promise.all(
    changes.facts.map(async (fact): Promise<PreparedFact> => {
      switch (fact.kind) {
        case 'node-deleted':
          return { fact, recipientIds: await activeRecipientIds(transaction, changes.roadmapId) };
        default:
          return { fact };
      }
    }),
  );
}

/**
 * Transitional translation for kinds the notice lifecycle module does not own yet;
 * their baseline writes still belong to roadmap until each target moves.
 */
async function deliver(
  changes: RoadmapChanges,
  prepared: readonly PreparedFact[],
  scheduleDelivery: NoticeDeliveryScheduler,
) {
  const { actorId, identifier, roadmapId } = changes;
  for (const { fact, recipientIds } of prepared) {
    try {
      switch (fact.kind) {
        case 'node-created':
          if (fact.current.isVisible)
            await deliverNodeChange(
              {
                userId: actorId,
                ...identifier,
                nodeId: fact.nodeId,
                roadmapId,
                changeKind: 'node-available',
                changedFields: [],
              },
              scheduleDelivery,
            );
          break;
        case 'node-deleted': {
          if (!fact.previous.isVisible) break;
          await deliverNodeChange(
            {
              userId: actorId,
              ...identifier,
              nodeId: fact.nodeId,
              roadmapId,
              changeKind: 'node-deleted',
              changedFields: [],
              nodeTitle: fact.previous.title,
              nodeTypeName: fact.nodeTypeName,
              targetKind: 'roadmap',
              recipientIds: recipientIds ?? [],
            },
            scheduleDelivery,
          );
          break;
        }
        case 'node-access':
          if (fact.recipientId !== actorId)
            await deliverNodeChange(
              {
                userId: actorId,
                ...identifier,
                roadmapId,
                nodeId: fact.nodeId,
                ...accessNoticeDestination(fact.current),
                changedFields: [],
                previousAccess: fact.previous,
                nodeTitle: fact.nodeTitle,
                nodeTypeName: fact.nodeTypeName,
                recipientIds: [fact.recipientId],
              },
              scheduleDelivery,
            );
          break;
        case 'roadmap-created':
          await deliverRoadmapAvailability(
            {
              ...fact.current,
              ...identifier,
              actorId,
              roadmapId,
              eventId: roadmapId,
              recipients: fact.current.recipients.filter(({ userId }) => userId !== actorId),
            },
            scheduleDelivery,
          );
          break;
        // Owned by the notice lifecycle module.
        case 'node-title':
        case 'node-description':
        case 'node-type':
        case 'resource':
        case 'dependency':
        case 'node-type-name':
          break;
        // Completion and promotion already reconcile inside their transactions in this prefactor.
        case 'node-visibility':
        case 'participation-role':
          break;
      }
    } catch {
      console.warn('Roadmap change notice delivery failed', { roadmapId, kind: fact.kind });
    }
  }
}

/** One composition for HTTP, pages, and the scheduled pass; no global registration. */
function noticesPort(scheduleDelivery: NoticeDeliveryScheduler): RoadmapChangePort {
  return {
    async report(transaction, changes) {
      if (!changes.facts.length) return;
      const lifecycle = await recordRoadmapNotices(transaction, changes);
      const prepared = await prepareDeliveryContext(transaction, changes);
      return async () => {
        await lifecycle?.(scheduleDelivery);
        await deliver(changes, prepared, scheduleDelivery);
      };
    },
  };
}

export const roadmapChangePort = noticesPort(after);

/** The Scheduled unlock pass has no request: it delivers immediately. */
export const scheduledRoadmapChangePort = noticesPort((persist) => persist());
