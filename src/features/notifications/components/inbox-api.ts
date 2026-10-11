import type { ChangeSummary } from '../contracts/change-summary';
import { OWN_INBOX_REFRESH_EVENT as refreshEvent } from './own-realtime';

export type InboxRecord = {
  id: string;
  courseName?: string;
  subject?: string | null;
  body?: string | null;
  data?: Record<string, unknown>;
  createdAt: string;
};

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/notifications${path}`, { cache: 'no-store', ...init });
  if (!response.ok) throw new Error('No se pudieron consultar los avisos.');
  return response.json();
}

export function postJson<T = unknown>(path: string, body: unknown) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type NoticeAcknowledgementOperation = { roadmapId: string; operationId: string };

export async function acknowledgeOwnInbox(input: NoticeAcknowledgementOperation) {
  const result = await postJson<{ acknowledged: number; summary: ChangeSummary | null }>(
    '/acknowledge',
    input,
  );
  window.dispatchEvent(new Event(refreshEvent));
  return result;
}

export async function prepareOwnInboxOpening(
  input: NoticeAcknowledgementOperation & { retry: boolean },
) {
  await postJson('/openings', input);
}
