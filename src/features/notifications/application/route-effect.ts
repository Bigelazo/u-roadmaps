import { dependencyTarget, nodeTypeNameTarget } from '@/shared/route-notice-target';
import type { NoticeEffect } from './notice-effect';

export type RoutePayload = NoticeEffect['payload'] & {
  routeTarget: 'dependency' | 'type';
  routeTargetKey: string;
  previousValue: string;
  occurredAt: string;
};
export type RouteEffect = Omit<NoticeEffect, 'payload'> & { payload: RoutePayload };
export type StoredRoutePayload = RoutePayload & { knownValue: string; currentValue: string };

export function routeEffect(effect: NoticeEffect): RouteEffect | null {
  const payload = effect.payload;
  if (
    effect.noticeClass !== 'roadmap-path-changed' &&
    effect.noticeClass !== 'roadmap-classification-changed'
  )
    return null;
  const dependency = effect.noticeClass === 'roadmap-path-changed';
  if (typeof payload.occurredAt !== 'string' || Number.isNaN(Date.parse(payload.occurredAt)))
    throw new Error('Invalid route notice timestamp.');
  if (dependency) {
    if (
      typeof payload.sourceNodeId !== 'string' ||
      typeof payload.targetNodeId !== 'string' ||
      (payload.changeKind !== 'dependency-added' && payload.changeKind !== 'dependency-removed')
    )
      throw new Error('Invalid Dependency notice pair.');
  } else if (typeof payload.nodeTypeId !== 'string' || typeof payload.previousTypeName !== 'string')
    throw new Error('Invalid Node type notice.');
  return {
    ...effect,
    payload: {
      ...payload,
      routeTarget: dependency ? 'dependency' : 'type',
      routeTargetKey: dependency
        ? dependencyTarget(String(payload.sourceNodeId), String(payload.targetNodeId))
        : nodeTypeNameTarget(String(payload.nodeTypeId)),
      previousValue: dependency
        ? String(payload.changeKind === 'dependency-removed')
        : String(payload.previousTypeName),
      occurredAt: payload.occurredAt,
    },
  };
}

export function storedRoutePayload(value: unknown): StoredRoutePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid stored route notice.');
  const payload = value as Record<string, unknown>;
  if (
    (payload.routeTarget !== 'dependency' && payload.routeTarget !== 'type') ||
    typeof payload.routeTargetKey !== 'string' ||
    typeof payload.knownValue !== 'string' ||
    typeof payload.currentValue !== 'string' ||
    typeof payload.previousValue !== 'string' ||
    typeof payload.occurredAt !== 'string'
  )
    throw new Error('Invalid stored route notice fields.');
  return payload as StoredRoutePayload;
}
