import { describe, expect, it, vi } from 'vitest';

const { Prisma } = vi.hoisted(() => {
  /** Stands in for Prisma's known request error (its `code`). */
  class PrismaClientKnownRequestError extends Error {
    constructor(readonly code: string) {
      super('failed');
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/shared/server/db', () => ({ Prisma, prisma: {} }));

import { isSerializationFailure } from '@/features/roadmap/application/roadmap-command';

function adapterConflict() {
  const error = new Error('TransactionWriteConflict');
  error.name = 'DriverAdapterError';
  return Object.assign(error, { cause: { kind: 'TransactionWriteConflict' } });
}

// A raw query's serialization failure (P2010) is checked against the real error in
// tests/notifications-integration/serialization-failure.test.ts; retries and their
// deliveries against PostgreSQL in tests/features/roadmap/roadmap-command.test.ts.
describe('isSerializationFailure', () => {
  it('recognizes a Prisma write conflict', () => {
    expect(isSerializationFailure(new Prisma.PrismaClientKnownRequestError('P2034'))).toBe(true);
  });

  it('recognizes the pg adapter conflict at COMMIT', () => {
    expect(isSerializationFailure(adapterConflict())).toBe(true);
  });

  it('leaves other failures alone', () => {
    expect(isSerializationFailure(new Prisma.PrismaClientKnownRequestError('P2002'))).toBe(false);
    expect(isSerializationFailure(new Error('boom'))).toBe(false);
  });
});
