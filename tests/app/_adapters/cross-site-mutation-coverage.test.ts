import { globSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { rejectCrossSiteMutation } from '@/app/_adapters/cross-site-mutation';
// eslint-disable-next-line boundaries/no-unknown-dependencies, boundaries/dependencies
import { config } from '@/proxy';

const site = 'https://roadmap.example.test';
const nativeFormPosts = new Set(['POST /api/logout', 'POST /api/plogin/start']);
const mutatingMethod = /^(POST|PUT|PATCH|DELETE)$/;

function exportedMethods(source: string) {
  const declared = [
    ...source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var)\s+([A-Z]+)\b/g),
  ].map(([, name]) => name);
  const listed = [...source.matchAll(/export\s*\{([^}]*)\}/g)].flatMap(([, names]) =>
    names.split(',').map(
      (name) =>
        name
          .trim()
          .split(/\s+as\s+/)
          .at(-1) ?? '',
    ),
  );
  return [...declared, ...listed].filter((name) => mutatingMethod.test(name));
}

function samplePath(file: string) {
  return (
    '/' +
    file
      .replace(/^src\/app\//, '')
      .replace(/\/?route\.ts$/, '')
      .split('/')
      .filter((segment) => !/^\(.*\)$/.test(segment))
      .map((segment) => segment.replace(/^\[{1,2}(?:\.\.\.)?(\w+)\]{1,2}$/, 'sample-$1'))
      .join('/')
  );
}

const mutations = globSync('src/app/**/route.{ts,tsx,js}').flatMap((file) =>
  exportedMethods(readFileSync(file, 'utf8')).map((method) => ({
    method,
    path: samplePath(file),
  })),
);

test('the route scan finds the known mutations', () => {
  expect(mutations).toEqual(
    expect.arrayContaining([
      { method: 'POST', path: '/api/logout' },
      {
        method: 'DELETE',
        path: '/api/sample-courseCode/sample-year/sample-semester/roadmap/dependencies',
      },
      { method: 'POST', path: '/api/notifications/node-changes' },
    ]),
  );
});

test.each(mutations)('$method $path runs behind the proxy', ({ path }) => {
  expect(unstable_doesMiddlewareMatch({ config, url: `${site}${path}` })).toBe(true);
});

test.each(mutations)('$method $path refuses a cross-site request', ({ method, path }) => {
  const response = rejectCrossSiteMutation(
    new NextRequest(`${site}${path}`, {
      method,
      headers: { origin: 'https://www.u-cursos.cl', 'sec-fetch-site': 'cross-site' },
    }),
  );

  expect(response.status).toBe(403);
});

test.each(mutations.filter(({ method, path }) => !nativeFormPosts.has(`${method} ${path}`)))(
  '$method $path refuses a same-origin request without the application header',
  ({ method, path }) => {
    const response = rejectCrossSiteMutation(
      new NextRequest(`${site}${path}`, {
        method,
        headers: { origin: site, 'sec-fetch-site': 'same-origin' },
      }),
    );

    expect(response.status).toBe(403);
  },
);

test('no Server Action can bypass the API proxy', () => {
  const serverActions = globSync('src/**/*.{ts,tsx,js,jsx,mjs}').filter((file) =>
    /['"]use server['"]/.test(readFileSync(file, 'utf8')),
  );

  expect(serverActions).toEqual([]);
});
