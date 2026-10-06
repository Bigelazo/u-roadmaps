import type { NoticeEffect } from './notice-effect';

export type NodeContentTarget = 'description' | 'nodeType';
export type NodeContentPayload = NoticeEffect['payload'] & {
  nodeId: string;
  contentTarget: NodeContentTarget;
  previousValue: string;
  occurredAt: string;
  previousTypeName?: string;
  currentTypeName?: string;
};
export type NodeContentEffect = Omit<NoticeEffect, 'payload'> & { payload: NodeContentPayload };
export type StoredNodeContentPayload = NodeContentPayload & {
  knownValue: string;
  currentValue: string;
  knownTypeName?: string;
};

function contentPayload(value: unknown): NodeContentPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Node content payload.');
  const data = value as Record<string, unknown>;
  if (
    typeof data.nodeId !== 'string' ||
    (data.contentTarget !== 'description' && data.contentTarget !== 'nodeType') ||
    typeof data.previousValue !== 'string' ||
    typeof data.occurredAt !== 'string' ||
    Number.isNaN(Date.parse(data.occurredAt)) ||
    (data.contentTarget === 'nodeType' &&
      (typeof data.previousTypeName !== 'string' || typeof data.currentTypeName !== 'string'))
  )
    throw new Error('Invalid Node content fields.');
  return data as NodeContentPayload;
}

export function nodeContentEffect(effect: NoticeEffect): NodeContentEffect | null {
  if (effect.noticeClass !== 'roadmap-node-changed' || effect.payload.contentTarget === undefined)
    return null;
  return { ...effect, payload: contentPayload(effect.payload) };
}

export function storedNodeContentPayload(value: unknown): StoredNodeContentPayload {
  const payload = contentPayload(value);
  if (
    typeof payload.knownValue !== 'string' ||
    typeof payload.currentValue !== 'string' ||
    (payload.contentTarget === 'nodeType' && typeof payload.knownTypeName !== 'string')
  )
    throw new Error('Invalid stored Node content.');
  return payload as StoredNodeContentPayload;
}
