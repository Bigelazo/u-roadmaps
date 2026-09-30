import { expect, test } from 'vitest';
import { createSubscriberHash } from '@/features/notifications/infrastructure/subscriber-hash';

test('creates the Novu HMAC-SHA256 for the canonical subscriber UUID', () => {
  expect(createSubscriberHash('550e8400-e29b-41d4-a716-446655440000', 'test-secret')).toBe(
    'a94f2f365abfe020d6cec64d7ee82da5d9da699780dd451ba15610c69c63283d',
  );
});
