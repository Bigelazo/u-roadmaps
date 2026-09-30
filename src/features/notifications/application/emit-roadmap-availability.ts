import type {
  ActiveRecipientLookup,
  NotificationTransport,
  RoadmapAvailabilityNotice,
} from '../contracts';
import { NotificationTransportError } from '../contracts';

const RECIPIENTS_PER_TRIGGER = 100;
const RECIPIENTS_PER_PROVISION = 500;
const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 3_000;

export async function emitRoadmapAvailability(
  notice: RoadmapAvailabilityNotice,
  transport: NotificationTransport,
  findActiveRecipients: ActiveRecipientLookup,
  workflowId: string,
) {
  if (!workflowId || notice.recipients.length === 0) return;

  for (let offset = 0; offset < notice.recipients.length; offset += RECIPIENTS_PER_PROVISION) {
    try {
      await withTimeout(
        transport.ensureSubscribers({
          eventId: notice.eventId,
          recipients: notice.recipients.slice(offset, offset + RECIPIENTS_PER_PROVISION),
        }),
        REQUEST_TIMEOUT_MS,
      );
    } catch {
      // Provisioning errors must not change the already committed Roadmap result.
    }
  }

  for (let offset = 0; offset < notice.recipients.length; offset += RECIPIENTS_PER_TRIGGER) {
    const batch = notice.recipients.slice(offset, offset + RECIPIENTS_PER_TRIGGER);
    const transactionId = `${notice.eventId}:roadmap-available:${offset}`;
    const payload = {
      roadmapId: notice.roadmapId,
      courseCode: notice.courseCode,
      year: notice.year,
      semester: notice.semester,
      targetKind: 'roadmap',
      changeKind: 'roadmap-available',
      occurredAt: notice.occurredAt.toISOString(),
      eventCount: 1,
      actorName: notice.actorName,
    };

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const startedAt = Date.now();
      let recipientCount = batch.length;
      try {
        const activeIds = await findActiveRecipients(batch.map(({ userId }) => userId)).catch(
          () => [],
        );
        if (activeIds.length === 0) break;
        recipientCount = activeIds.length;
        const result = await withTimeout(
          transport.trigger({
            workflowId,
            roadmapId: notice.roadmapId,
            eventId: notice.eventId,
            transactionId,
            recipients: activeIds,
            payload,
          }),
          REQUEST_TIMEOUT_MS,
        );
        console.info('Novu trigger accepted', {
          eventId: notice.eventId,
          workflowId,
          roadmapId: notice.roadmapId,
          recipientCount: activeIds.length,
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          result: 'accepted',
        });
        if (result.retryAfterMs === undefined) break;
        const remainingMs = (MAX_ATTEMPTS - attempt - 1) * REQUEST_TIMEOUT_MS;
        if (attempt + 1 >= MAX_ATTEMPTS || result.retryAfterMs > remainingMs) break;
        await delay(result.retryAfterMs);
      } catch (error) {
        console.warn('Novu trigger failed', {
          eventId: notice.eventId,
          workflowId,
          roadmapId: notice.roadmapId,
          recipientCount,
          attempt: attempt + 1,
          result: 'failed',
        });
        if (error instanceof NotificationTransportError && !error.retryable) break;
        if (error instanceof NotificationTransportError && error.retryAfterMs !== undefined) {
          const remainingMs = (MAX_ATTEMPTS - attempt - 1) * REQUEST_TIMEOUT_MS;
          if (error.retryAfterMs > remainingMs) break;
          if (error.retryAfterMs > 0) await delay(error.retryAfterMs);
        }
        if (attempt + 1 >= MAX_ATTEMPTS) break;
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

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
