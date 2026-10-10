import 'server-only';
import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';

/** Attempts of one serializable transaction before a serialization failure becomes a 409. */
export const SERIALIZABLE_MAX_ATTEMPTS = 5;

export type SerializableOptions = Readonly<{
  timeout?: number;
  /** The 409 to raise once every attempt hit a serialization failure (ADR-0015). */
  concurrentModification?: () => ApplicationError;
}>;

const defaultConcurrentModification = () =>
  new ApplicationError(409, 'CONFLICT', 'La operación entra en conflicto con otra modificación.');

/**
 * Run `operation` in a SERIALIZABLE transaction that prefers index scans, retrying
 * serialization failures with exponential backoff. Every attempt is a new transaction,
 * so `operation` must keep no state across attempts.
 */
export async function serializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: SerializableOptions = {},
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          await preferIndexScans(transaction);
          return operation(transaction);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: options.timeout },
      );
    } catch (error) {
      if (!isSerializationFailure(error)) throw error;
      if (attempt === SERIALIZABLE_MAX_ATTEMPTS - 1)
        throw (options.concurrentModification ?? defaultConcurrentModification)();
      // Separate attempts so unrelated concurrent Roadmaps can finish their writes.
      await delay(50 * 2 ** attempt + Math.random() * 50);
    }
  }
}

/**
 * Under SERIALIZABLE a sequential scan takes a relation-level predicate lock, so an edit
 * on one Roadmap would conflict with any concurrent write to that table on another
 * Roadmap. Small tables make the planner prefer sequential scans even where an index
 * matches (#220), so serializable Roadmap transactions steer it to index scans, which
 * lock only the rows and index pages they read.
 */
async function preferIndexScans(transaction: Prisma.TransactionClient) {
  await transaction.$executeRaw`SET LOCAL enable_seqscan = off`;
}

/**
 * A serialization failure, as Prisma reports it (P2034), as the pg adapter reports it
 * at COMMIT, or wrapped in a raw query's failure (P2010).
 */
export function isSerializationFailure(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return (
      error.code === 'P2034' ||
      (error.code === 'P2010' && isAdapterWriteConflict(error.meta?.driverAdapterError))
    );
  return isAdapterWriteConflict(error);
}

function isAdapterWriteConflict(error: unknown) {
  return (
    error instanceof Error &&
    error.name === 'DriverAdapterError' &&
    typeof error.cause === 'object' &&
    error.cause !== null &&
    'kind' in error.cause &&
    error.cause.kind === 'TransactionWriteConflict'
  );
}
