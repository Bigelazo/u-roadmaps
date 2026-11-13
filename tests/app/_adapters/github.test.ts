import { afterEach, expect, test, vi } from 'vitest';
import { readRepositoryStars } from '@/app/_adapters/github';

afterEach(() => {
  vi.unstubAllGlobals();
});

function respondWith(response: Response | Error) {
  const fetch = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

test('reads the star count from the repository and caches it for a week', async () => {
  const fetch = respondWith(Response.json({ stargazers_count: 42 }));

  await expect(readRepositoryStars()).resolves.toBe(42);
  expect(fetch).toHaveBeenCalledWith(
    'https://api.github.com/repos/Bigelazo/u-roadmaps',
    expect.objectContaining({ next: { revalidate: 604_800 } }),
  );
});

test.each([
  ['GitHub rejects the request', new Response('rate limited', { status: 403 })],
  ['the response has no star count', Response.json({ name: 'u-roadmaps' })],
  ['GitHub is unreachable', new Error('network down')],
])('has no star count when %s', async (_, response) => {
  respondWith(response);

  await expect(readRepositoryStars()).resolves.toBeNull();
});
