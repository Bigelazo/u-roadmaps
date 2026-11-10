import { expect, test } from 'vitest';
import { applicationSessionCookie } from '@/features/institutional-access/infrastructure/session';

test('over HTTPS the session cookie travels into the roadmap embedded in U-Cursos', () => {
  const cookie = applicationSessionCookie(new Request('https://roadmap.example.test/api/plogin'));

  expect(cookie).toMatchObject({
    name: '__Secure-next-auth.session-token',
    sameSite: 'none',
    secure: true,
    httpOnly: true,
  });
});

test('over plain HTTP the session cookie stays first-party', () => {
  const cookie = applicationSessionCookie(new Request('http://localhost:3000/api/plogin'));

  expect(cookie).toMatchObject({
    name: 'next-auth.session-token',
    sameSite: 'lax',
    secure: false,
  });
});
