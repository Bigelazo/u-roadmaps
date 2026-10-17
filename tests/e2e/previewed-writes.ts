import type { APIRequestContext, APIResponse } from '@playwright/test';

type Send = (options: { headers: Record<string, string> }) => Promise<APIResponse>;

/**
 * Sends a previewed write the way the canvas confirms it: reads its Change impact, then
 * sends that version in `header`. A refused preview sends the write without one, so the
 * write's own response carries the refusal.
 */
async function confirm(api: APIRequestContext, previewPath: string, header: string, send: Send) {
  const preview = await api.get(previewPath);
  const version: unknown = preview.ok() ? (await preview.json()).version : undefined;
  return send({ headers: typeof version === 'string' ? { [header]: version } : {} });
}

/** Hides the Node at `nodePath` (`…/roadmap/nodes/:id`). */
export function hideNode(api: APIRequestContext, nodePath: string) {
  return confirm(api, `${nodePath}?operation=HIDE`, 'x-node-visibility-preview', (options) =>
    api.patch(nodePath, { data: { isVisible: false }, ...options }),
  );
}

/** Deletes the Node at `nodePath` (`…/roadmap/nodes/:id`). */
export function deleteNode(api: APIRequestContext, nodePath: string) {
  return confirm(api, `${nodePath}?operation=DELETE`, 'x-node-delete-preview', (options) =>
    api.delete(nodePath, options),
  );
}

const teacherBlockMethods = { BLOCK: 'post', UNBLOCK: 'delete', BRANCH_UNLOCK: 'patch' } as const;

/** Applies a Teacher block operation to the Node at `nodePath` (`…/roadmap/nodes/:id`). */
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

/** Creates a Dependency through `dependenciesPath` (`…/roadmap/dependencies`). */
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
