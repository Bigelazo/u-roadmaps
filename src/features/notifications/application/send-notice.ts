import {
  NotificationTransportError,
  type ActiveRecipientLookup,
  type NotificationTransport,
  type RoadmapAvailabilityRecipient,
} from '../contracts';

const REQUEST_TIMEOUT_MS = 3_000;
const MAX_ATTEMPTS = 2;

type NoticeDelivery = Readonly<{
  eventId: string;
  roadmapId: string;
  changeKind: string;
  recipients: readonly RoadmapAvailabilityRecipient[];
  payload: Readonly<Record<string, string | number>>;
}>;

// Acceptance by Novu is observable; it does not prove Inbox delivery.
export async function sendNotice(
  notice: NoticeDelivery,
  transport: NotificationTransport,
  findActiveRecipients: ActiveRecipientLookup,
  workflowId: string,
) {
  if (!workflowId || !notice.recipients.length) return;
  for (let offset = 0; offset < notice.recipients.length; offset += 500) {
    const startedAt = Date.now();
    const recipients = notice.recipients.slice(offset, offset + 500);
    try {
      await withTimeout(transport.ensureSubscribers({ eventId: notice.eventId, recipients }));
      log('provision', 'accepted', 1, startedAt, recipients.length);
    } catch {
      log('provision', 'failed', 1, startedAt, recipients.length);
    }
  }

  for (let offset = 0; offset < notice.recipients.length; offset += 100) {
    const batch = notice.recipients.slice(offset, offset + 100);
    const transactionId = `${notice.eventId}:${notice.changeKind}:${offset}`;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const startedAt = Date.now();
      let recipientCount = batch.length;
      try {
        const activeIds = await findActiveRecipients(batch.map(({ userId }) => userId));
        recipientCount = activeIds.length;
        if (!recipientCount) {
          log('trigger', 'skipped', attempt, startedAt, 0);
          break;
        }
        const result = await withTimeout(
          transport.trigger({
            workflowId,
            eventId: notice.eventId,
            roadmapId: notice.roadmapId,
            transactionId,
            recipients: activeIds,
            payload: notice.payload,
          }),
        );
        log('trigger', 'accepted', attempt, startedAt, recipientCount);
        if (result.retryAfterMs === undefined) break;
        if (!(await waitForRetry(result.retryAfterMs, attempt))) break;
      } catch (error) {
        log('trigger', 'failed', attempt, startedAt, recipientCount);
        if (error instanceof NotificationTransportError && !error.retryable) break;
        const retryAfterMs = error instanceof NotificationTransportError ? error.retryAfterMs : 0;
        if (!(await waitForRetry(retryAfterMs ?? 0, attempt))) break;
      }
    }
  }

  function log(
    operation: 'provision' | 'trigger',
    result: 'accepted' | 'failed' | 'skipped',
    attempt: number,
    startedAt: number,
    recipientCount: number,
  ) {
    const fields = {
      eventId: notice.eventId,
      workflowId,
      roadmapId: notice.roadmapId,
      operation,
      attempt,
      durationMs: Date.now() - startedAt,
      recipientCount,
      result,
    };
    if (result === 'failed') console.warn('Novu request failed', fields);
    else console.info('Novu request result', fields);
  }
}

function withTimeout<T>(promise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new NotificationTransportError('Notification transport timed out.', true)),
      REQUEST_TIMEOUT_MS,
    );
    promise.then(
      (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function waitForRetry(retryAfterMs: number, attempt: number) {
  if (
    attempt >= MAX_ATTEMPTS ||
    !Number.isFinite(retryAfterMs) ||
    retryAfterMs < 0 ||
    retryAfterMs > REQUEST_TIMEOUT_MS
  )
    return false;
  if (retryAfterMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, retryAfterMs));
  return true;
}
