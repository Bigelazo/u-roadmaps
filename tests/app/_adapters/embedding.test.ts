// @vitest-environment node
import { expect, test } from 'vitest';
import { isFramedRequest } from '@/app/_adapters/embedding';

const requestHeaders = (fetchDestination?: string) =>
  new Headers(fetchDestination ? { 'sec-fetch-dest': fetchDestination } : {});

test.each(['iframe', 'frame'])('a %s navigation is rendered framed', (destination) => {
  expect(isFramedRequest(requestHeaders(destination))).toBe(true);
});

test.each([undefined, 'document', 'empty', 'embed'])(
  'a request with fetch destination %s is rendered as the full application',
  (destination) => {
    expect(isFramedRequest(requestHeaders(destination))).toBe(false);
  },
);
