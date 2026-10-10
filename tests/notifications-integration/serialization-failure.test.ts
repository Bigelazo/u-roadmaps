import { expect } from 'vitest';
import { Prisma, prisma } from '@/shared/server/db';
import { isSerializationFailure } from '@/features/roadmap/application/serializable';
import { test } from './fixtures';

test('a raw query that hits a serialization failure is recognized', async ({ course }) => {
  let snapshotTaken!: () => void;
  const started = new Promise<void>((resolve) => (snapshotTaken = resolve));
  let release!: () => void;
  const committed = new Promise<void>((resolve) => (release = resolve));
  const failing = prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${course.roadmapId}::uuid`;
      snapshotTaken();
      await committed;
      // The row changed after this transaction's snapshot: 40001 on this statement.
      await transaction.$executeRaw`UPDATE "Roadmap" SET id = id WHERE id = ${course.roadmapId}::uuid`;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  await started;
  await prisma.$executeRaw`UPDATE "Roadmap" SET id = id WHERE id = ${course.roadmapId}::uuid`;
  release();
  const error = await failing.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2010');
  expect(isSerializationFailure(error)).toBe(true);
});
