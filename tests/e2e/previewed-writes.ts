import type { APIRequestContext, APIResponse } from '@playwright/test';

type Send = (options: { headers: Record<string, string> }) => Promise<APIResponse>;

async function confirm(
  api: APIRequestContext,
  path: string,
  change: Record<string, string>,
  send: Send,
) {
  const roadmapPath = path.replace(/\/(nodes\/[^/]+|dependencies)$/, '');
  const impact = await api.get(`${roadmapPath}/change-impact?${new URLSearchParams(change)}`);
  const version: unknown = impact.ok() ? (await impact.json()).version : undefined;
  return send({
    headers: typeof version === 'string' ? { 'x-change-impact-version': version } : {},
  });
}

const nodeId = (nodePath: string) => nodePath.slice(nodePath.lastIndexOf('/') + 1);

export function hideNode(api: APIRequestContext, nodePath: string) {
  return confirm(api, nodePath, { kind: 'hide-node', nodeId: nodeId(nodePath) }, (options) =>
    api.patch(nodePath, { data: { isVisible: false }, ...options }),
  );
}

export function deleteNode(api: APIRequestContext, nodePath: string) {
  return confirm(api, nodePath, { kind: 'delete-node', nodeId: nodeId(nodePath) }, (options) =>
    api.delete(nodePath, options),
  );
}

const teacherBlockMethods = { BLOCK: 'post', UNBLOCK: 'delete', BRANCH_UNLOCK: 'patch' } as const;

export function changeTeacherBlock(
  api: APIRequestContext,
  nodePath: string,
  operation: keyof typeof teacherBlockMethods = 'BLOCK',
) {
  const change = { kind: 'change-teacher-block', nodeId: nodeId(nodePath), operation };
  return confirm(api, nodePath, change, (options) =>
    api[teacherBlockMethods[operation]](`${nodePath}/teacher-block`, options),
  );
}

export function connectNodes(
  api: APIRequestContext,
  dependenciesPath: string,
  dependency: { sourceNodeId: string; targetNodeId: string } & Record<string, string>,
) {
  return confirm(api, dependenciesPath, { kind: 'create-dependency', ...dependency }, (options) =>
    api.post(dependenciesPath, { data: dependency, ...options }),
  );
}
