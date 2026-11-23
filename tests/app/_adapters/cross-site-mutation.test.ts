import { afterEach, expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { rejectCrossSiteMutation } from '@/app/_adapters/cross-site-mutation';
import { sameSiteRequestHeaders } from '@/shared/same-site-request';

const roadmapUrl = 'https://roadmap.example.test/api/CC5003/2026/2/roadmap/nodes';

function apiRequest(method: string, headers: Record<string, string> = {}, url = roadmapUrl) {
  return new NextRequest(url, { method, headers });
}

afterEach(() => {
  delete process.env.NEXTAUTH_URL;
});

test('a mutation sent from another site is rejected before reaching the route', async () => {
  const response = rejectCrossSiteMutation(
    apiRequest('POST', {
      origin: 'https://www.u-cursos.cl',
      'sec-fetch-site': 'cross-site',
      ...sameSiteRequestHeaders,
    }),
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
      ...sameSiteRequestHeaders,
    }),
  );
  const withoutBrowserHeaders = rejectCrossSiteMutation(apiRequest('POST', sameSiteRequestHeaders));

  expect(sameOrigin.headers.get('x-middleware-next')).toBe('1');
  expect(withoutBrowserHeaders.headers.get('x-middleware-next')).toBe('1');
});

test('a same-origin mutation without the application request header is rejected', async () => {
  process.env.NEXTAUTH_URL = 'https://roadmap.example.test';

  for (const headers of [
    { origin: 'https://roadmap.example.test', 'sec-fetch-site': 'same-origin' },
    {} as Record<string, string>,
  ]) {
    const response = rejectCrossSiteMutation(apiRequest('DELETE', headers));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'CROSS_SITE_REQUEST' } });
  }
});

test('the native form posts reach their routes from the same origin without the header', () => {
  for (const url of [
    'https://roadmap.example.test/api/logout',
    'https://roadmap.example.test/api/plogin/start',
  ]) {
    const response = rejectCrossSiteMutation(
      apiRequest('POST', { 'sec-fetch-site': 'same-origin' }, url),
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
  }
});

test('the native form exemption covers only its exact paths', () => {
  for (const url of [
    'https://roadmap.example.test/api/logout/other',
    'https://roadmap.example.test/api/plogin/start/other',
    'https://roadmap.example.test/api/plogin',
  ]) {
    const response = rejectCrossSiteMutation(
      apiRequest('POST', { 'sec-fetch-site': 'same-origin' }, url),
    );

    expect(response.status).toBe(403);
  }
});

test('a cross-site native form post is rejected', () => {
  for (const url of [
    'https://roadmap.example.test/api/logout',
    'https://roadmap.example.test/api/plogin/start',
  ]) {
    const response = rejectCrossSiteMutation(
      apiRequest(
        'POST',
        { origin: 'https://www.u-cursos.cl', 'sec-fetch-site': 'cross-site' },
        url,
      ),
    );

    expect(response.status).toBe(403);
  }
});

test('reads from another site are left to the route', () => {
  const response = rejectCrossSiteMutation(
    apiRequest('GET', { origin: 'https://www.u-cursos.cl', 'sec-fetch-site': 'cross-site' }),
  );

  expect(response.headers.get('x-middleware-next')).toBe('1');
});

test('a cross-site mutation under the institutional login path is rejected', async () => {
  for (const url of [
    'https://roadmap.example.test/api/plogin',
    'https://roadmap.example.test/api/plogin/start',
    'https://roadmap.example.test/api/plogin/2026/2/roadmap/nodes',
    'https://roadmap.example.test/api/auth/session',
  ]) {
    const response = rejectCrossSiteMutation(
      apiRequest(
        'POST',
        { origin: 'https://login.example.test', 'sec-fetch-site': 'cross-site' },
        url,
      ),
    );

    expect(response.status).toBe(403);
  }
});
