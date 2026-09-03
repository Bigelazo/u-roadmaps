import { afterEach, expect, test } from 'vitest';
import { isHttps, siteOrigin, siteUrl } from '@/shared/server/environment/site-url';

const internalRequest = (headers: Record<string, string>) =>
  new Request('http://0.0.0.0:5210/api/plogin?jwt=token', { headers });

afterEach(() => {
  delete process.env.NEXTAUTH_URL;
});

test('proxied requests resolve to the public origin instead of the internal listener', () => {
  const request = internalRequest({
    'x-forwarded-host': 'roadmaps.example.test',
    'x-forwarded-proto': 'https',
    host: '0.0.0.0:5210',
  });

  expect(siteOrigin(request).origin).toBe('https://roadmaps.example.test');
  expect(siteUrl('/academic-overview', request).toString()).toBe(
    'https://roadmaps.example.test/academic-overview',
  );
  expect(isHttps(request)).toBe(true);
});

test('the configured public URL wins over proxy headers', () => {
  process.env.NEXTAUTH_URL = 'https://roadmaps.example.test';
  const request = internalRequest({ 'x-forwarded-host': 'atacante.example.test' });

  expect(siteUrl('/', request).toString()).toBe('https://roadmaps.example.test/');
});

test('a plain request without proxy headers keeps its own origin', () => {
  const request = new Request('http://localhost:3000/api/plogin');

  expect(siteUrl('/?error=Authentication', request).toString()).toBe(
    'http://localhost:3000/?error=Authentication',
  );
  expect(isHttps(request)).toBe(false);
});

test('a proxy terminating TLS upgrades a public URL configured over http', () => {
  process.env.NEXTAUTH_URL = 'http://roadmaps.example.test';
  const request = internalRequest({ 'x-forwarded-proto': 'https' });

  expect(siteOrigin(request).origin).toBe('https://roadmaps.example.test');
  expect(isHttps(request)).toBe(true);
});

test('a request that the proxy reports as http keeps its scheme', () => {
  process.env.NEXTAUTH_URL = 'http://roadmaps.example.test';
  const request = internalRequest({ 'x-forwarded-proto': 'http' });

  expect(siteOrigin(request).origin).toBe('http://roadmaps.example.test');
});
