import type {
  ActiveRecipientLookup,
  NotificationTransport,
  RoadmapAvailabilityRecipient,
} from '../contracts';
import { NotificationTransportError } from '../contracts';

const REQUEST_TIMEOUT_MS = 3_000;

type RoadmapScopedNotice = Readonly<{
  eventId: string;
  roadmapId: string;
  courseCode: string;
  year: number;
  semester: number;
  changeKind: string;
  occurredAt: Date;
  actorName: string;
  noticeTitle: string;
  noticeBody: string;
  recipients: readonly RoadmapAvailabilityRecipient[];
}>;

export async function emitRoadmapScopedNotice(
  notice: RoadmapScopedNotice,
  transport: NotificationTransport,
  findActiveRecipients: ActiveRecipientLookup,
  workflowId: string,
) {
  if (!workflowId || notice.recipients.length === 0) return;

  for (let offset = 0; offset < notice.recipients.length; offset += 500) {
    const recipients = notice.recipients.slice(offset, offset + 500);
    await transport
      .ensureSubscribers({ eventId: notice.eventId, recipients })
      .catch(() => undefined);
  }

  for (let offset = 0; offset < notice.recipients.length; offset += 100) {
    const batch = notice.recipients.slice(offset, offset + 100);
    const transactionId = `${notice.eventId}:${notice.changeKind}:${offset}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const activeIds = await findActiveRecipients(batch.map(({ userId }) => userId));
        if (!activeIds.length) break;
        await withTimeout(
          transport.trigger({
            workflowId,
            roadmapId: notice.roadmapId,
            eventId: notice.eventId,
            transactionId,
            recipients: activeIds,
            payload: {
              roadmapId: notice.roadmapId,
              courseCode: notice.courseCode,
              year: notice.year,
              semester: notice.semester,
              targetKind: 'roadmap',
              changeKind: notice.changeKind,
              occurredAt: notice.occurredAt.toISOString(),
              eventCount: 1,
              actorName: notice.actorName,
              noticeTitle: notice.noticeTitle,
              noticeBody: notice.noticeBody,
            },
          }),
          REQUEST_TIMEOUT_MS,
        );
        break;
      } catch (error) {
        if (error instanceof NotificationTransportError && !error.retryable) break;
        if (attempt === 1) break;
      }
    }
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new NotificationTransportError('Notification transport timed out.', true)),
      timeoutMs,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}
