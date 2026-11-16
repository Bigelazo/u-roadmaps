// @vitest-environment node
import { gunzipSync } from 'node:zlib';
import { beforeEach, expect, test, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { handleApplicationResult } from '@/app/_adapters/http';

const request = vi.hoisted(() => ({ acceptEncoding: 'gzip, deflate, br' as string | null }));

vi.mock('@/app/_adapters/auth', () => ({}));
vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError }, prisma: {} };
});
vi.mock('next/headers', () => ({
  headers: async () => {
    if (request.acceptEncoding === null) throw new Error('outside a request scope');
    return new Headers({ 'accept-encoding': request.acceptEncoding });
  },
}));

const largeBody = {
  nodes: Array.from({ length: 200 }, (_, index) => ({ id: index, title: 'Nodo' })),
};

beforeEach(() => {
  request.acceptEncoding = 'gzip, deflate, br';
});

test('a large JSON response is gzipped for a request that accepts it', async () => {
  const response = await handleApplicationResult(async () => NextResponse.json(largeBody));
  expect(response.headers.get('content-encoding')).toBe('gzip');
  expect(response.headers.get('vary')).toContain('Accept-Encoding');
  const sent = Buffer.from(await response.arrayBuffer());
  expect(sent.byteLength).toBeLessThan(JSON.stringify(largeBody).length);
  expect(JSON.parse(gunzipSync(sent).toString())).toEqual(largeBody);
});

test('a gzipped response keeps its status, cookies and cache policy', async () => {
  const response = await handleApplicationResult(async () => {
    const created = NextResponse.json(largeBody, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
    created.cookies.set('session', 'value');
    return created;
  });
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.getSetCookie()).toHaveLength(1);
});

test('a small JSON response is sent as it is', async () => {
  const response = await handleApplicationResult(async () => NextResponse.json({ count: 3 }));
  expect(response.headers.get('content-encoding')).toBeNull();
  expect(await response.json()).toEqual({ count: 3 });
});

test('a request that does not accept gzip receives plain JSON', async () => {
  request.acceptEncoding = 'identity';
  const response = await handleApplicationResult(async () => NextResponse.json(largeBody));
  expect(response.headers.get('content-encoding')).toBeNull();
  expect(await response.json()).toEqual(largeBody);
});

test('a handler called outside a request scope receives plain JSON', async () => {
  request.acceptEncoding = null;
  const response = await handleApplicationResult(async () => NextResponse.json(largeBody));
  expect(response.headers.get('content-encoding')).toBeNull();
});

test('a response that is not JSON is left untouched', async () => {
  const stream = new Response('event: ready\n\n'.repeat(200), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
  expect(await handleApplicationResult(async () => stream)).toBe(stream);
});
