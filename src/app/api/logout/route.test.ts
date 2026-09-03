import { expect, test } from 'vitest';
import { POST } from '@/app/api/logout/route';

test('logout expires all application authentication cookies before returning home', () => {
  const response = POST(
    new Request('https://u-roadmaps.example.test/api/logout', { method: 'POST' }),
  );

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
});
