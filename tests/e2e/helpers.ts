import { encode } from 'next-auth/jwt';
import type { BrowserContext } from '@playwright/test';
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

export async function sessionCookie(userId: string) {
  const value = await encode({ token: { sub: userId }, secret: sessionSecret });
  return `${sessionCookieName}=${value}`;
}

export async function authenticateAs(context: BrowserContext, userId: string) {
  const value = await encode({ token: { sub: userId }, secret: sessionSecret });
  await context.addCookies([{ name: sessionCookieName, value, domain: 'localhost', path: '/' }]);
}
