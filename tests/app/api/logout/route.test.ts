// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { POST } from '@/app/api/logout/route';

const { getApplicationSession, updateManyUsers } = vi.hoisted(() => ({
  getApplicationSession: vi.fn(),
  updateManyUsers: vi.fn(),
}));
vi.mock('@/shared/server/session', () => ({ getApplicationSession }));
vi.mock('@/shared/server/db', () => ({
  Prisma: {},
  prisma: { user: { updateMany: updateManyUsers } },
}));

afterEach(() => vi.resetAllMocks());

const userId = '11111111-1111-4111-8111-111111111111';

function logout() {
  return POST(new Request('https://u-roadmaps.example.test/api/logout', { method: 'POST' }));
}

function expectAuthenticationCookiesExpiredAndHomeRedirect(response: Response) {
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('https://u-roadmaps.example.test/');
  expect(response.headers.getSetCookie()).toEqual(
    expect.arrayContaining([
      expect.stringContaining('next-auth.session-token=;'),
      expect.stringContaining('__Secure-next-auth.session-token=;'),
      expect.stringContaining('next-auth.csrf-token=;'),
      expect.stringContaining('__Host-next-auth.csrf-token=;'),
      expect.stringContaining('next-auth.callback-url=;'),
      expect.stringContaining('u-roadmaps-vti-state=;'),
    ]),
  );

  for (const name of ['__Secure-next-auth.session-token', '__Host-next-auth.csrf-token']) {
    const header = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));
    expect(header).toMatch(/;\s*secure/i);
    expect(header).toMatch(/;\s*path=\/(;|$)/i);
    expect(header).toMatch(/max-age=0|expires=thu, 01 jan 1970/i);
  }
}

test('logout revokes every session of the User and expires the authentication cookies', async () => {
  getApplicationSession.mockResolvedValue({ user: { id: userId, issuedAt: 1 } });
  updateManyUsers.mockResolvedValue({ count: 1 });
  const before = Date.now();

  const response = await logout();

  expect(updateManyUsers).toHaveBeenCalledOnce();
  const [{ where, data }] = updateManyUsers.mock.calls[0];
  expect(where).toEqual({ id: userId });
  expect(data.sessionsRevokedAt).toBeInstanceOf(Date);
  expect(data.sessionsRevokedAt.getTime()).toBeGreaterThanOrEqual(before);
  expectAuthenticationCookiesExpiredAndHomeRedirect(response);
});

test('logout without a session expires the authentication cookies without revoking', async () => {
  getApplicationSession.mockResolvedValue(null);

  const response = await logout();

  expect(updateManyUsers).not.toHaveBeenCalled();
  expectAuthenticationCookiesExpiredAndHomeRedirect(response);
});

test('logout still expires the authentication cookies when the revocation fails', async () => {
  getApplicationSession.mockResolvedValue({ user: { id: userId, issuedAt: 1 } });
  updateManyUsers.mockRejectedValue(new Error('database unavailable'));
  const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  const response = await logout();

  expect(logError).toHaveBeenCalledOnce();
  expectAuthenticationCookiesExpiredAndHomeRedirect(response);
});
