import { beforeEach, describe, expect, it, vi } from 'vitest';

const { Prisma, prisma } = vi.hoisted(() => {
  /** Stands in for Prisma's known request error (its `code`). */
  class PrismaClientKnownRequestError extends Error {
    constructor(readonly code: string) {
      super('failed');
    }
  }
  return {
    Prisma: {
      PrismaClientKnownRequestError,
      TransactionIsolationLevel: { Serializable: 'Serializable' },
    },
    prisma: { $transaction: vi.fn() },
  };
});
vi.mock('@/shared/server/db', () => ({ Prisma, prisma }));

import {
  isSerializationFailure,
  SERIALIZABLE_MAX_ATTEMPTS,
  serializableTransaction,
} from '@/features/roadmap/application/serializable';
import { ApplicationError } from '@/shared/errors/server';

function adapterConflict() {
  const error = new Error('TransactionWriteConflict');
  error.name = 'DriverAdapterError';
  return Object.assign(error, { cause: { kind: 'TransactionWriteConflict' } });
}

// A raw query's serialization failure (P2010) is checked against the real error in
// tests/notifications-integration/serialization-failure.test.ts.
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

describe('serializableTransaction', () => {
  const statements: string[] = [];
  const transaction = {
    $executeRaw: async (sql: TemplateStringsArray) => statements.push(sql.join('?')),
  };

  beforeEach(() => {
    statements.length = 0;
    prisma.$transaction.mockReset();
  });

  it('prefers index scans in a serializable transaction', async () => {
    prisma.$transaction.mockImplementation(async (operation) => operation(transaction));
    await expect(serializableTransaction(async () => 'done')).resolves.toBe('done');
    expect(statements).toEqual(['SET LOCAL enable_seqscan = off']);
    expect(prisma.$transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('retries serialization failures, then answers 409', async () => {
    prisma.$transaction.mockRejectedValue(adapterConflict());
    const error = await serializableTransaction(async () => 'never').catch((caught) => caught);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.status).toBe(409);
    expect(prisma.$transaction).toHaveBeenCalledTimes(SERIALIZABLE_MAX_ATTEMPTS);
  });

  it('succeeds on a later attempt', async () => {
    prisma.$transaction
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('P2034'))
      .mockImplementation(async (operation) => operation(transaction));
    await expect(serializableTransaction(async () => 'done')).resolves.toBe('done');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry other failures', async () => {
    prisma.$transaction.mockRejectedValue(new Error('boom'));
    await expect(serializableTransaction(async () => 'never')).rejects.toThrow('boom');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
