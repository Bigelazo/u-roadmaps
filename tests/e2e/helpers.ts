import { encode } from 'next-auth/jwt';
import { expect, type APIResponse, type BrowserContext } from '@playwright/test';
import { developmentFixtureIds, fixtureRoadmaps } from '@/development';

const [cc1002Roadmap] = fixtureRoadmaps;

// Read-only seeded catalog identities, used only by development-fixture.spec.ts.
export const fixture = {
  daniela: developmentFixtureIds.daniela,
  nicolas: developmentFixtureIds.nicolas,
  cc1002StudentWithoutProgress: '20000000-0000-4000-8000-000000000001',
  cc1002StudentComplete: '20000000-0000-4000-8000-000000000048',
  cc1002: {
    courseCode: 'CC1002',
    year: 2026,
    semester: 2,
    hiddenNode: cc1002Roadmap.nodes[12].id,
  },
  ma1001: {
    courseCode: 'MA1001',
    year: 2026,
    semester: 2,
  },
  fi1001Historical: {
    courseCode: 'FI1001',
    year: 2026,
    semester: 1,
  },
  fi1001Current: { courseCode: 'FI1001', year: 2026, semester: 2 },
} as const;

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
