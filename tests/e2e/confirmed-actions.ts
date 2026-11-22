import type { APIRequestContext, APIResponse } from '@playwright/test';
import { CHANGE_IMPACT_VERSION_HEADER } from '@/shared/change-impact';

type Send = (options: { headers: Record<string, string> }) => Promise<APIResponse>;

async function confirm(
  api: APIRequestContext,
  roadmapPath: string,
  change: Record<string, string>,
  send: Send,
) {
  const impact = await api.get(`${roadmapPath}/change-impact?${new URLSearchParams(change)}`);
  const version: unknown = impact.ok() ? (await impact.json()).version : undefined;
  return send({
    headers: typeof version === 'string' ? { [CHANGE_IMPACT_VERSION_HEADER]: version } : {},
  });
}

export function hideNode(api: APIRequestContext, roadmapPath: string, nodeId: string) {
  return confirm(api, roadmapPath, { kind: 'hide-node', nodeId }, (options) =>
    api.patch(`${roadmapPath}/nodes/${nodeId}`, { data: { isVisible: false }, ...options }),
  );
}

export function deleteNode(api: APIRequestContext, roadmapPath: string, nodeId: string) {
  return confirm(api, roadmapPath, { kind: 'delete-node', nodeId }, (options) =>
    api.delete(`${roadmapPath}/nodes/${nodeId}`, options),
  );
}

const teacherBlockMethods = { BLOCK: 'post', UNBLOCK: 'delete', BRANCH_UNLOCK: 'patch' } as const;

export function changeTeacherBlock(
  api: APIRequestContext,
  roadmapPath: string,
  nodeId: string,
  operation: keyof typeof teacherBlockMethods = 'BLOCK',
) {
  const change = { kind: 'change-teacher-block', nodeId, operation };
  return confirm(api, roadmapPath, change, (options) =>
    api[teacherBlockMethods[operation]](`${roadmapPath}/nodes/${nodeId}/teacher-block`, options),
  );
}

export function connectNodes(
  api: APIRequestContext,
  roadmapPath: string,
  dependency: { sourceNodeId: string; targetNodeId: string } & Record<string, string>,
) {
  return confirm(api, roadmapPath, { kind: 'create-dependency', ...dependency }, (options) =>
    api.post(`${roadmapPath}/dependencies`, { data: dependency, ...options }),
  );
}
