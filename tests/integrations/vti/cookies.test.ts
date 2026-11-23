import { expect, test } from 'vitest';
import { vtiLoginState, vtiLoginStateCookie } from '@/integrations/vti/server/cookies';

function callback(url: string, cookie: string) {
  return new Request(url, { headers: { cookie } });
}

test('over HTTPS the login state cookie is host-only and secure', () => {
  const cookie = vtiLoginStateCookie(new Request('https://roadmap.example.test/api/plogin/start'));

  expect(cookie).toMatchObject({
    name: '__Host-u-roadmaps-vti-state',
    secure: true,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  expect(cookie).not.toHaveProperty('domain');
});

test('over HTTPS only the host-only login state cookie is read', () => {
  const url = 'https://roadmap.example.test/api/plogin';

  expect(vtiLoginState(callback(url, '__Host-u-roadmaps-vti-state=fresh'))).toBe('fresh');
  expect(vtiLoginState(callback(url, 'u-roadmaps-vti-state=injected'))).toBeUndefined();
});

test('over plain HTTP the login state cookie keeps its unprefixed name', () => {
  const cookie = vtiLoginStateCookie(new Request('http://localhost:3000/api/plogin/start'));

  expect(cookie).toMatchObject({ name: 'u-roadmaps-vti-state', secure: false });
  expect(
    vtiLoginState(callback('http://localhost:3000/api/plogin', 'u-roadmaps-vti-state=local')),
  ).toBe('local');
});
