import { afterEach, expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { rejectCrossSiteMutation } from '@/app/_adapters/cross-site-mutation';

const roadmapUrl = 'https://roadmap.example.test/api/CC5003/2026/2/roadmap/nodes';

function apiRequest(method: string, headers: Record<string, string> = {}, url = roadmapUrl) {
  return new NextRequest(url, { method, headers });
}

afterEach(() => {
  delete process.env.NEXTAUTH_URL;
});

test('a mutation sent from another site is rejected before reaching the route', async () => {
  const response = rejectCrossSiteMutation(
    apiRequest('POST', { origin: 'https://www.u-cursos.cl', 'sec-fetch-site': 'cross-site' }),
  );

  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: 'CROSS_SITE_REQUEST' } });
});

test('a mutation from a sibling subdomain is rejected', () => {
  const response = rejectCrossSiteMutation(
    apiRequest('DELETE', { origin: 'https://otra.uchile.cl', 'sec-fetch-site': 'same-site' }),
  );

  expect(response.status).toBe(403);
});

test('a mutation whose origin differs from the site is rejected when fetch metadata is missing', () => {
  const response = rejectCrossSiteMutation(
    apiRequest('PATCH', { origin: 'https://www.u-cursos.cl' }),
  );

  expect(response.status).toBe(403);
});

test('a mutation from the application itself reaches the route', () => {
  process.env.NEXTAUTH_URL = 'https://roadmap.example.test';

  const sameOrigin = rejectCrossSiteMutation(
    apiRequest('POST', {
      origin: 'https://roadmap.example.test',
      'sec-fetch-site': 'same-origin',
    }),
  );
  const withoutBrowserHeaders = rejectCrossSiteMutation(apiRequest('POST'));

  expect(sameOrigin.headers.get('x-middleware-next')).toBe('1');
  expect(withoutBrowserHeaders.headers.get('x-middleware-next')).toBe('1');
});

test('reads from another site are left to the route', () => {
  const response = rejectCrossSiteMutation(
    apiRequest('GET', { origin: 'https://www.u-cursos.cl', 'sec-fetch-site': 'cross-site' }),
  );

  expect(response.headers.get('x-middleware-next')).toBe('1');
});

test('the institutional login callback keeps validating its own origin', () => {
  const response = rejectCrossSiteMutation(
    apiRequest(
      'POST',
      { origin: 'https://login.example.test', 'sec-fetch-site': 'cross-site' },
      'https://roadmap.example.test/api/plogin',
    ),
  );

  expect(response.headers.get('x-middleware-next')).toBe('1');
});
