import type { ChangeSummary } from '../contracts/change-summary';

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

export function acknowledgeOwnInbox(input: NoticeAcknowledgementOperation) {
  return postJson<{ acknowledged: number; summary: ChangeSummary | null }>('/acknowledge', input);
}

export async function prepareOwnInboxOpening(input: NoticeAcknowledgementOperation) {
  await postJson('/openings', input);
}
