// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { ApplicationError } from '@/shared/errors/types';

const { countOwnCourseOfferingNotices, session } = vi.hoisted(() => ({
  countOwnCourseOfferingNotices: vi.fn(),
  session: { userId: '11111111-1111-1111-1111-111111111111' as string | null },
}));
vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/features/notifications/server', () => ({ countOwnCourseOfferingNotices }));
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => {
    if (!session.userId)
      throw new ApplicationError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
    return { id: session.userId };
  },
}));
import { GET } from '@/app/api/[courseCode]/[year]/[semester]/notifications/count/route';

const countRequest = (path: string) =>
  new Request(`http://localhost/api/${path}/notifications/count?roadmapId=ignored`);
const routeContext = (courseCode: string, year: string, semester: string) => ({
  params: Promise.resolve({ courseCode, year, semester }),
});

beforeEach(() => {
  vi.resetAllMocks();
  session.userId = '11111111-1111-1111-1111-111111111111';
});

test('the unread count is read for the session user and the decoded Course offering', async () => {
  countOwnCourseOfferingNotices.mockResolvedValue({ unread: 4 });
  const response = await GET(
    countRequest('CC%203002/2026/2'),
    routeContext('CC%203002', '2026', '2'),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/json');
  await expect(response.json()).resolves.toEqual({ unread: 4 });
  expect(countOwnCourseOfferingNotices).toHaveBeenCalledWith(session.userId, {
    courseCode: 'CC 3002',
    year: 2026,
    semester: 2,
  });
});

test('an invalid academic identity is refused before counting', async () => {
  const response = await GET(countRequest('CC3002/2026/3'), routeContext('CC3002', '2026', '3'));
  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe('INVALID_ACADEMIC_IDENTITY');
  expect(countOwnCourseOfferingNotices).not.toHaveBeenCalled();
});

test('an anonymous request receives the shared unauthenticated refusal without counting', async () => {
  session.userId = null;
  const response = await GET(countRequest('CC3002/2026/2'), routeContext('CC3002', '2026', '2'));
  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: { code: 'UNAUTHENTICATED', message: 'Debes iniciar sesión para continuar.' },
  });
  expect(countOwnCourseOfferingNotices).not.toHaveBeenCalled();
});
