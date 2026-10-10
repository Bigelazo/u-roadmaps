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

/** A serialization failure, as Prisma or (at COMMIT) the pg adapter reports it. */
export function isSerializationFailure(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === 'P2034';
  // The pg adapter can expose serialization failures directly when COMMIT fails.
  return (
    error instanceof Error &&
    error.name === 'DriverAdapterError' &&
    typeof error.cause === 'object' &&
    error.cause !== null &&
    'kind' in error.cause &&
    error.cause.kind === 'TransactionWriteConflict'
  );
}
