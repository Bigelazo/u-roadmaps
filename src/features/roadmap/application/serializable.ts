import 'server-only';
import { Prisma } from '@/shared/server/db';

/**
 * Under SERIALIZABLE a sequential scan takes a relation-level predicate lock, so an edit
 * on one Roadmap would conflict with any concurrent write to that table on another
 * Roadmap. Small tables make the planner prefer sequential scans even where an index
 * matches (#220), so serializable Roadmap transactions steer it to index scans, which
 * lock only the rows and index pages they read.
 */
export async function preferIndexScans(transaction: Prisma.TransactionClient) {
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
