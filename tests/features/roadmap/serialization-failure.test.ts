// @vitest-environment node
import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { Prisma } from '@/shared/server/db';
import { isSerializationFailure } from '@/features/roadmap/application/roadmap-command/change';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('failed', {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });
}

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
    expect(isSerializationFailure(prismaError('P2034'))).toBe(true);
  });

  it('recognizes the pg adapter conflict at COMMIT', () => {
    expect(isSerializationFailure(adapterConflict())).toBe(true);
  });

  it('leaves other failures alone', () => {
    expect(isSerializationFailure(prismaError('P2002'))).toBe(false);
    expect(isSerializationFailure(new Error('boom'))).toBe(false);
  });
});
