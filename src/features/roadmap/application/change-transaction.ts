import 'server-only';
import { prisma, type Prisma } from '@/shared/server/db';
import { serializableTransaction, type SerializableOptions } from './serializable';
import type { RoadmapChangePort, RoadmapChanges } from './change-port';

export type RoadmapChangeReporter = (changes: RoadmapChanges) => Promise<void>;

/**
 * Run a Roadmap change and deliver what it reported only after commit. With
 * `serializable`, the change runs in `serializableTransaction` (index scans, retries);
 * only the committed attempt's deliveries run.
 */
export async function roadmapChangeTransaction<T>(
  port: RoadmapChangePort,
  operation: (transaction: Prisma.TransactionClient, report: RoadmapChangeReporter) => Promise<T>,
  options?: { timeout?: number; serializable?: SerializableOptions | true },
): Promise<T> {
  let committedWork: (() => void | Promise<void>)[] = [];
  const attempt = (transaction: Prisma.TransactionClient) => {
    committedWork = [];
    return operation(transaction, async (changes) => {
      const work = await port.report(transaction, changes);
      if (work) committedWork.push(work);
    });
  };
  const serializable = options?.serializable;
  const result = serializable
    ? await serializableTransaction(attempt, {
        timeout: options.timeout,
        ...(serializable === true ? {} : serializable),
      })
    : await prisma.$transaction(
        attempt,
        options?.timeout ? { timeout: options.timeout } : undefined,
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
