import 'server-only';

import { Novu } from '@novu/api';
import { NotificationTransportError, type NotificationTransport } from '../contracts';

let novuClient: Novu | null = null;

function client() {
  const secretKey = process.env.NOVU_SECRET_KEY;
  if (!secretKey) throw new Error('Novu is not configured.');
  if (!novuClient) {
    const serverURL = process.env.NOVU_SERVER_URL;
    novuClient = new Novu({ secretKey, ...(serverURL ? { serverURL } : {}) });
  }
  return novuClient;
}

function splitName(name: string) {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

function retryMetadata(error: unknown) {
  if (typeof error !== 'object' || error === null) return { retryable: true };
  const source = error as {
    status?: number;
    statusCode?: number;
    headers?: Headers | Record<string, string>;
    response?: { status?: number; headers?: Headers | Record<string, string> };
  };
  const status = source.status ?? source.statusCode ?? source.response?.status;
  const headers = source.headers ?? source.response?.headers;
  const retryAfter =
    headers instanceof Headers
      ? headers.get('retry-after')
      : headers && typeof headers === 'object'
        ? (headers['retry-after'] ?? headers['Retry-After'])
        : undefined;
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
  const retryAfterMs = Number.isFinite(retryAfterSeconds)
    ? Math.max(0, retryAfterSeconds * 1000)
    : retryAfter && !Number.isNaN(Date.parse(retryAfter))
      ? Math.max(0, Date.parse(retryAfter) - Date.now())
      : undefined;
  return {
    retryable: status === undefined || status === 429 || status >= 500,
    retryAfterMs,
  };
}

export const novuTransport: NotificationTransport = {
  async ensureSubscribers({ eventId, recipients }) {
    try {
      await client().subscribers.createBulk(
        {
          subscribers: recipients.map(({ userId, name }) => ({
            subscriberId: userId,
            ...splitName(name),
          })),
        },
        `${eventId}:subscribers:${recipients[0]?.userId ?? 'empty'}`,
        { timeoutMs: 3_000 },
      );
    } catch {
      throw new NotificationTransportError('Subscriber provisioning failed.', false);
    }
  },
  async trigger({ workflowId, transactionId, recipients, payload }) {
    try {
      await client().trigger(
        { workflowId, transactionId, to: [...recipients], payload },
        transactionId,
        { timeoutMs: 3_000 },
      );
      return {};
    } catch (error) {
      const metadata = retryMetadata(error);
      throw new NotificationTransportError(
        'Novu did not accept the notification trigger.',
        metadata.retryable,
        metadata.retryAfterMs,
      );
    }
  },
};
