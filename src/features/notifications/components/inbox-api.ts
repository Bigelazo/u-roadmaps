import { OWN_INBOX_REFRESH_EVENT as refreshEvent } from './own-realtime';

export type InboxRecord = {
  id: string;
  subject?: string | null;
  body?: string | null;
  data?: Record<string, unknown>;
  createdAt: string;
  seen: () => Promise<{ error?: unknown }>;
  read: () => Promise<{ error?: unknown }>;
};

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/notifications${path}`, { cache: 'no-store', ...init });
  if (!response.ok) throw new Error('No se pudieron consultar los avisos.');
  return response.json();
}

export function record(value: Omit<InboxRecord, 'seen' | 'read'>): InboxRecord {
  const mark = async (action: string) => {
    try {
      await request(`/${value.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (action === 'read') window.dispatchEvent(new Event(refreshEvent));
      return {};
    } catch (error) {
      return { error };
    }
  };
  return { ...value, seen: () => mark('seen'), read: () => mark('read') };
}

export async function getOwnInboxRecord(id: string) {
  return record(await request<Omit<InboxRecord, 'seen' | 'read'>>(`/${encodeURIComponent(id)}`));
}

export type NoticeAcknowledgementOperation = { roadmapId: string; operationId: string };

export async function acknowledgeOwnInbox(input: NoticeAcknowledgementOperation) {
  await request('/acknowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  window.dispatchEvent(new Event(refreshEvent));
}

export async function prepareOwnInboxNodeOpening(
  input: NoticeAcknowledgementOperation & { nodeId: string; retry: boolean },
) {
  await request('/openings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
