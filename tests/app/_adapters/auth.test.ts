// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { resolveSessionUser } from '@/app/_adapters/auth';

const { findUser } = vi.hoisted(() => ({ findUser: vi.fn() }));
vi.mock('@/features/roadmap/server', () => ({ synchronizeCourseOffering: vi.fn() }));
vi.mock('@/app/_adapters/roadmap-changes', () => ({ roadmapChangePort: {} }));
vi.mock('@/shared/server/session', () => ({ getApplicationSession: vi.fn() }));
vi.mock('@/shared/server/db', () => ({ prisma: { user: { findUnique: findUser } } }));

afterEach(() => vi.resetAllMocks());

const revokedAt = new Date('2026-11-23T12:00:00.000Z');
const revokedAtSeconds = Math.floor(revokedAt.getTime() / 1000);

function sessionIssuedAt(issuedAt: number | undefined) {
  return {
    expires: '2026-12-23T12:00:00.000Z',
    user: { id: crypto.randomUUID(), issuedAt },
  };
}

test.each([
  { case: 'before the revocation', issuedAt: revokedAtSeconds - 60 },
  { case: 'in the same second as the revocation', issuedAt: revokedAtSeconds },
  { case: 'without an issue time', issuedAt: undefined },
])('rejects a session issued $case', async ({ issuedAt }) => {
  const session = sessionIssuedAt(issuedAt);
  findUser.mockResolvedValue({ id: session.user.id, sessionsRevokedAt: revokedAt });

  await expect(resolveSessionUser(session)).resolves.toBeNull();
});

test.each([
  { case: 'after the revocation', sessionsRevokedAt: revokedAt, issuedAt: revokedAtSeconds + 1 },
  { case: 'for a User without revocations', sessionsRevokedAt: null, issuedAt: 0 },
])('accepts a session issued $case', async ({ sessionsRevokedAt, issuedAt }) => {
  const session = sessionIssuedAt(issuedAt);
  findUser.mockResolvedValue({ id: session.user.id, sessionsRevokedAt });

  await expect(resolveSessionUser(session)).resolves.toMatchObject({ id: session.user.id });
});
