import 'server-only';
import { prisma, type Prisma } from '@/shared/server/db';
import type { RoadmapChangePort, RoadmapChanges } from './change-port';

export type RoadmapChangeReporter = (changes: RoadmapChanges) => Promise<void>;

export async function roadmapChangeTransaction<T>(
  port: RoadmapChangePort,
  operation: (transaction: Prisma.TransactionClient, report: RoadmapChangeReporter) => Promise<T>,
  options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number },
): Promise<T> {
  const committedWork: (() => void | Promise<void>)[] = [];
  const result = await prisma.$transaction(
    async (transaction) =>
      operation(transaction, async (changes) => {
        const work = await port.report(transaction, changes);
        if (work) committedWork.push(work);
      }),
    options,
  );
  for (const work of committedWork) {
    try {
      await work();
    } catch {
      console.warn('Roadmap change delivery failed');
    }
  }
  return result;
}
