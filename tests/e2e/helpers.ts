import { encode } from 'next-auth/jwt';
import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const sessionCookieName = 'next-auth.session-token';
const sessionSecret = process.env.NEXTAUTH_SECRET ?? 'e2e-nextauth-secret';

export function fixtureRoadmapPath(
  identifier: { courseCode: string; year: number; semester: number },
  suffix = '',
) {
  return `/api/${identifier.courseCode}/${identifier.year}/${identifier.semester}/roadmap${suffix}`;
}

function sessionToken(userId: string) {
  return encode({ token: { sub: userId }, secret: sessionSecret });
}

export async function sessionCookie(userId: string) {
  return `${sessionCookieName}=${await sessionToken(userId)}`;
}

export async function authenticateAs(context: BrowserContext, userId: string) {
  const value = await sessionToken(userId);
  await context.addCookies([{ name: sessionCookieName, value, domain: 'localhost', path: '/' }]);
}

export async function ok(response: APIResponse, status = 200) {
  expect(response.status(), await response.text()).toBe(status);
  return response;
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toast(page: Page, message: string) {
  return page
    .locator('[data-slot="toast-viewport"] [data-slot="toast"]')
    .filter({ has: page.locator('[data-slot="toast-title"]', { hasText: message }) });
}

type ReviewedResource = { id: string; type: 'FILE' | 'LINK'; url: string };

export async function reviewNodeResources(
  api: APIRequestContext,
  roadmapPath: string,
  nodeId: string,
  scope: 'student' | 'canvas-preview' = 'student',
) {
  const roadmap = await (
    await ok(await api.get(scope === 'student' ? roadmapPath : `${roadmapPath}/simulation`))
  ).json();
  const resources: ReviewedResource[] =
    roadmap.nodes.find((node: { id: string }) => node.id === nodeId)?.resources ?? [];
  for (const resource of resources) {
    if (scope === 'canvas-preview')
      await ok(await api.post(`${roadmapPath}/simulation/resources/${resource.id}/review`), 204);
    else if (resource.type === 'LINK')
      await ok(await api.post(`${roadmapPath}/resources/${resource.id}/access`), 204);
    else await ok(await api.get(resource.url));
  }
}
