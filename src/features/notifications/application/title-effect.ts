import type { NoticeEffect } from './notice-effect';

export type TitleNoticePayload = NoticeEffect['payload'] &
  Readonly<{
    nodeId: string;
    previousTitle: string;
    occurredAt: string;
  }>;
export type TitleNoticeEffect = Omit<NoticeEffect, 'payload'> & { payload: TitleNoticePayload };
export type StoredTitlePayload = TitleNoticePayload &
  Readonly<{
    knownTitle: string;
    currentTitle: string;
  }>;

function titlePayload(value: unknown): TitleNoticePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid title notice payload.');
  const record = value as Record<string, unknown>;
  if (
    typeof record.nodeId !== 'string' ||
    typeof record.previousTitle !== 'string' ||
    typeof record.occurredAt !== 'string' ||
    Number.isNaN(Date.parse(record.occurredAt))
  )
    throw new Error('Invalid title notice fields.');
  return record as TitleNoticePayload;
}

export function titleEffect(effect: NoticeEffect): TitleNoticeEffect | null {
  if (effect.noticeClass !== 'roadmap-node-changed' || effect.payload.previousTitle === undefined)
    return null;
  return { ...effect, payload: titlePayload(effect.payload) };
}

export function storedTitlePayload(value: unknown): StoredTitlePayload {
  const payload = titlePayload(value);
  if (typeof payload.knownTitle !== 'string' || typeof payload.currentTitle !== 'string')
    throw new Error('Invalid stored title notice.');
  return payload as StoredTitlePayload;
}
