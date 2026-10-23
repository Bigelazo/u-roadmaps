import type { APIRequestContext, APIResponse } from '@playwright/test';

type Send = (options: { headers: Record<string, string> }) => Promise<APIResponse>;

async function confirm(api: APIRequestContext, previewPath: string, header: string, send: Send) {
  const preview = await api.get(previewPath);
  const version: unknown = preview.ok() ? (await preview.json()).version : undefined;
  return send({ headers: typeof version === 'string' ? { [header]: version } : {} });
}

export function hideNode(api: APIRequestContext, nodePath: string) {
  return confirm(api, `${nodePath}?operation=HIDE`, 'x-node-visibility-preview', (options) =>
    api.patch(nodePath, { data: { isVisible: false }, ...options }),
  );
}

export function deleteNode(api: APIRequestContext, nodePath: string) {
  return confirm(api, `${nodePath}?operation=DELETE`, 'x-node-delete-preview', (options) =>
    api.delete(nodePath, options),
  );
}

const teacherBlockMethods = { BLOCK: 'post', UNBLOCK: 'delete', BRANCH_UNLOCK: 'patch' } as const;

export function changeTeacherBlock(
  api: APIRequestContext,
  nodePath: string,
  operation: keyof typeof teacherBlockMethods = 'BLOCK',
) {
  const path = `${nodePath}/teacher-block`;
  return confirm(api, `${path}?operation=${operation}`, 'x-teacher-block-preview', (options) =>
    api[teacherBlockMethods[operation]](path, options),
  );
}

export function connectNodes(
  api: APIRequestContext,
  dependenciesPath: string,
  dependency: { sourceNodeId: string; targetNodeId: string } & Record<string, string>,
) {
  const query = new URLSearchParams(dependency);
  return confirm(api, `${dependenciesPath}?${query}`, 'x-dependency-preview', (options) =>
    api.post(dependenciesPath, { data: dependency, ...options }),
  );
}
