import { encode } from 'next-auth/jwt';
import { expect, type APIResponse, type BrowserContext, type Page } from '@playwright/test';

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

/** Asserts a response's status, printing its body when the status differs. */
export async function ok(response: APIResponse, status = 200) {
  expect(response.status(), await response.text()).toBe(status);
  return response;
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A toast in the app-level stack, found by its title (Base UI also mirrors it into a live region). */
export function toast(page: Page, message: string) {
  return page
    .locator('[data-slot="toast-viewport"] [data-slot="toast"]')
    .filter({ has: page.locator('[data-slot="toast-title"]', { hasText: message }) });
}
