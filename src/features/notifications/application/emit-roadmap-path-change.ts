import type {
  ActiveRecipientLookup,
  NotificationTransport,
  RoadmapPathChangeNotice,
} from '../contracts';
import { NotificationTransportError } from '../contracts';

const REQUEST_TIMEOUT_MS = 3_000;

export async function emitRoadmapPathChange(
  notice: RoadmapPathChangeNotice,
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
    const requirement =
      notice.changeKind === 'dependency-added' ? 'ahora requiere' : 'ya no requiere';
    const noticeBody =
      `${notice.actorName.slice(0, 48)} actualizó la ruta de ${notice.courseCode.slice(0, 32)}: «${notice.dependentNodeTitle.slice(0, 64)}» ${requirement} «${notice.prerequisiteNodeTitle.slice(0, 64)}».`.slice(
        0,
        256,
      );

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
              noticeTitle: 'Ruta actualizada',
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
