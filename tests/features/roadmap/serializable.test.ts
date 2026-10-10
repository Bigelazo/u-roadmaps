import { describe, expect, it, vi } from 'vitest';

const { Prisma } = vi.hoisted(() => {
  /** Stands in for Prisma's known request error (its `code` and `meta`). */
  class PrismaClientKnownRequestError extends Error {
    constructor(
      message: string,
      readonly fields: { code: string; meta?: Record<string, unknown> },
    ) {
      super(message);
    }
    get code() {
      return this.fields.code;
    }
    get meta() {
      return this.fields.meta;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/shared/server/db', () => ({ Prisma }));

import { isSerializationFailure } from '@/features/roadmap/application/serializable';

function adapterConflict() {
  const error = new Error('TransactionWriteConflict');
  error.name = 'DriverAdapterError';
  return Object.assign(error, { cause: { kind: 'TransactionWriteConflict' } });
}

const known = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('failed', { code, meta });

describe('isSerializationFailure', () => {
  it('recognizes a Prisma write conflict', () => {
    expect(isSerializationFailure(known('P2034'))).toBe(true);
  });

  it('recognizes the pg adapter conflict at COMMIT', () => {
    expect(isSerializationFailure(adapterConflict())).toBe(true);
  });

  it('recognizes a conflict raised by a raw query', () => {
    expect(isSerializationFailure(known('P2010', { driverAdapterError: adapterConflict() }))).toBe(
      true,
    );
  });

  it('leaves other failures alone', () => {
    expect(isSerializationFailure(known('P2002'))).toBe(false);
    expect(isSerializationFailure(known('P2010', { code: '23505' }))).toBe(false);
    expect(isSerializationFailure(new Error('boom'))).toBe(false);
  });
});
