import 'server-only';
import { Prisma, prisma } from '@/shared/server/db';
import type { RoadmapChangePort, RoadmapChanges } from './change-port';

export type RoadmapChangeReporter = (changes: RoadmapChanges) => Promise<void>;

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

export async function roadmapChangeTransaction<T>(
  port: RoadmapChangePort,
  operation: (transaction: Prisma.TransactionClient, report: RoadmapChangeReporter) => Promise<T>,
  options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number },
): Promise<T> {
  const committedWork: (() => void | Promise<void>)[] = [];
  const result = await prisma.$transaction(async (transaction) => {
    if (options?.isolationLevel === Prisma.TransactionIsolationLevel.Serializable)
      await preferIndexScans(transaction);
    return operation(transaction, async (changes) => {
      const work = await port.report(transaction, changes);
      if (work) committedWork.push(work);
    });
  }, options);
  for (const work of committedWork) {
    try {
      await work();
    } catch {
      console.warn('Roadmap change delivery failed');
    }
  }
  return result;
}
