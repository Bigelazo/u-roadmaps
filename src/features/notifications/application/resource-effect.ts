import type { NoticeEffect } from './notice-effect';
import type { ResourceNoticeState } from '../contracts/resource-state';

export type ResourceNoticePayload = NoticeEffect['payload'] &
  Readonly<{
    resourceId: string;
    nodeId: string;
    occurredAt: string;
    previousResource: ResourceNoticeState | null;
  }>;
export type ResourceNoticeEffect = Omit<NoticeEffect, 'payload'> & {
  payload: ResourceNoticePayload;
};
export type StoredResourcePayload = ResourceNoticePayload &
  Readonly<{
    knownResource: ResourceNoticeState | null;
    currentResource: ResourceNoticeState | null;
  }>;

export function resourceNoticeState(value: unknown): ResourceNoticeState | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Resource notice state.');
  const state = value as Record<string, unknown>;
  if (typeof state.title !== 'string' || typeof state.revision !== 'string')
    throw new Error('Invalid Resource notice state fields.');
  return { title: state.title, revision: state.revision };
}

function resourcePayload(value: unknown): ResourceNoticePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Resource notice payload.');
  const payload = value as Record<string, unknown>;
  if (
    typeof payload.resourceId !== 'string' ||
    typeof payload.nodeId !== 'string' ||
    typeof payload.occurredAt !== 'string' ||
    Number.isNaN(Date.parse(payload.occurredAt))
  )
    throw new Error('Invalid Resource notice fields.');
  resourceNoticeState(payload.previousResource);
  return payload as ResourceNoticePayload;
}

export function resourceEffect(effect: NoticeEffect): ResourceNoticeEffect | null {
  if (effect.noticeClass !== 'roadmap-resource-changed' || effect.payload.resourceId === undefined)
    return null;
  return { ...effect, payload: resourcePayload(effect.payload) };
}

export function storedResourcePayload(value: unknown): StoredResourcePayload {
  const payload = resourcePayload(value);
  resourceNoticeState(payload.knownResource);
  resourceNoticeState(payload.currentResource);
  return payload as StoredResourcePayload;
}
