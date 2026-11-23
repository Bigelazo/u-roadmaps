// @vitest-environment node
import { expect, test } from 'vitest';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { authOptions } from '@/shared/server/session';

function exposeSession(token: JWT) {
  const session = { expires: '', user: {} } as Session;
  return authOptions.callbacks!.session!({ session, token } as never);
}

test.each([
  {
    case: 'the token issue time',
    token: { sub: 'user', iat: 1_790_000_000 },
    issuedAt: 1_790_000_000,
  },
  { case: 'zero when the token lacks an issue time', token: { sub: 'user' }, issuedAt: 0 },
])('exposes $case to the session User', async ({ token, issuedAt }) => {
  await expect(exposeSession(token)).resolves.toMatchObject({ user: { id: 'user', issuedAt } });
});
