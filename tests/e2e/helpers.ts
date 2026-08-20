import { encode } from 'next-auth/jwt';
import type { BrowserContext } from '@playwright/test';

export const fixture = {
  teacher: '10000000-0000-4000-8000-000000000001',
  studentWithoutProgress: '20000000-0000-4000-8000-000000000001',
  studentWithProgress: '20000000-0000-4000-8000-000000000002',
  inactiveStudent: '20000000-0000-4000-8000-000000000051',
  studentWithoutProgressVtiClaims: {
    identification: '000020000001-5',
    email: 'estudiante01@example.test',
    name: 'Estudiante 01',
  },
  programming: {
    courseCode: 'CC1001',
    year: 2026,
    semester: 2,
    firstNode: '60000000-0000-4000-8000-000000000001',
    secondNode: '60000000-0000-4000-8000-000000000002',
    hiddenNode: '60000000-0000-4000-8000-000000000018',
  },
  calculus: { courseCode: 'MA1001', year: 2026, semester: 2 },
  physics: { courseCode: 'FI1001', year: 2026, semester: 2 },
} as const;

const sessionCookieName = 'next-auth.session-token';
const sessionSecret = process.env.NEXTAUTH_SECRET ?? 'e2e-nextauth-secret';

export function roadmapPath(suffix = '') {
  const { courseCode, year, semester } = fixture.programming;
  return `/api/${courseCode}/${year}/${semester}/roadmap${suffix}`;
}

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
