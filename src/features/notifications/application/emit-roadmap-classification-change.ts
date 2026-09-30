import type {
  ActiveRecipientLookup,
  NotificationTransport,
  RoadmapClassificationChangeNotice,
} from '../contracts';
import { NotificationTransportError } from '../contracts';

const REQUEST_TIMEOUT_MS = 3_000;

export async function emitRoadmapClassificationChange(
  notice: RoadmapClassificationChangeNotice,
  transport: NotificationTransport,
  findActiveRecipients: ActiveRecipientLookup,
  workflowId: string,
) {
  if (!workflowId || notice.recipients.length === 0) return;

  for (let offset = 0; offset < notice.recipients.length; offset += 500) {
    await transport
      .ensureSubscribers({
        eventId: notice.eventId,
        recipients: notice.recipients.slice(offset, offset + 500),
      })
      .catch(() => undefined);
  }

  for (let offset = 0; offset < notice.recipients.length; offset += 100) {
    const batch = notice.recipients.slice(offset, offset + 100);
    const transactionId = `${notice.eventId}:classification-updated:${offset}`;
    const noticeTitle = `Tipo «${notice.previousTypeName}» → «${notice.nextTypeName}»`.slice(
      0,
      256,
    );
    const noticeBody =
      `${notice.actorName.slice(0, 96)} actualizó la clasificación del Roadmap de ${notice.courseCode.slice(0, 32)}.`.slice(
        0,
        256,
      );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const activeIds = await findActiveRecipients(batch.map(({ userId }) => userId));
        if (activeIds.length === 0) break;
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
              changeKind: 'classification-updated',
              occurredAt: notice.occurredAt.toISOString(),
              eventCount: 1,
              actorName: notice.actorName,
              noticeTitle,
              noticeBody,
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
