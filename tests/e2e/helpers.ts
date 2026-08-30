import { encode } from 'next-auth/jwt';
import type { BrowserContext } from '@playwright/test';
import { developmentFixtureIds, fixtureRoadmaps } from '@/lib/development-fixtures';

const [cc1002Roadmap, ma1001Roadmap, fi1001HistoricalRoadmap] = fixtureRoadmaps;

export const fixture = {
  daniela: developmentFixtureIds.daniela,
  nicolas: developmentFixtureIds.nicolas,
  camila: developmentFixtureIds.camila,
  cc1002StudentWithoutProgress: '20000000-0000-4000-8000-000000000001',
  cc1002StudentWithProgress: '20000000-0000-4000-8000-000000000009',
  cc1002StudentComplete: '20000000-0000-4000-8000-000000000048',
  cc1002WithdrawnStudent: '20000000-0000-4000-8000-000000000050',
  fi1001CurrentWithdrawnStudent: '20000000-0000-4000-8000-000000000047',
  cc1002StudentWithoutProgressVtiClaims: {
    identification: '000020000001-5',
    email: 'antonia.valdes.pino@u-roadmaps.test',
    name: 'Antonia Valdés Pino',
  },
  cc1002: {
    courseCode: 'CC1002',
    year: 2026,
    semester: 2,
    firstNode: cc1002Roadmap.nodes[0].id,
    secondNode: cc1002Roadmap.nodes[1].id,
    hiddenNode: cc1002Roadmap.nodes[12].id,
  },
  ma1001: {
    courseCode: 'MA1001',
    year: 2026,
    semester: 2,
    firstNode: ma1001Roadmap.nodes[0].id,
  },
  fi1001Historical: {
    courseCode: 'FI1001',
    year: 2026,
    semester: 1,
    firstNode: fi1001HistoricalRoadmap.nodes[0].id,
  },
  fi1001Current: { courseCode: 'FI1001', year: 2026, semester: 2 },
} as const;

const sessionCookieName = 'next-auth.session-token';
const sessionSecret = process.env.NEXTAUTH_SECRET ?? 'e2e-nextauth-secret';

export function roadmapPath(suffix = '') {
  const { courseCode, year, semester } = fixture.cc1002;
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
