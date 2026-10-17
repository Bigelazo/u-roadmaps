import 'server-only';
import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import type { RoadmapChangeFact, RoadmapChangePort, RoadmapChanges } from '../change-port';
import { accessChanges } from '../access-changes';
import { readAccessSnapshot } from '../access-snapshot';
import { conflict, roadmapClosed, roadmapNotFound } from '../errors';

/** Attempts of one serializable change before a serialization failure becomes a 409. */
const SERIALIZABLE_MAX_ATTEMPTS = 5;

export type RoadmapChangeReporter = (changes: RoadmapChanges) => Promise<void>;

export type ChangeTransactionOptions = Readonly<{
  /** SERIALIZABLE unless the caller is not retry-safe (Roadmap creation, materialisation). */
  isolation?: 'serializable' | 'read-committed';
  timeout?: number;
  /** The message of the 409 once every serializable attempt hit a serialization failure. */
  conflictMessage?: string;
}>;

/**
 * The one transaction policy for Roadmap changes. A serializable change prefers index
 * scans and retries serialization failures with backoff. What `operation` reports goes
 * to the port inside the transaction; the port's deliveries run only after the commit,
 * and only the committed attempt's. A failed delivery is logged and never fails the change.
 */
export async function roadmapChangeTransaction<T>(
  port: RoadmapChangePort,
  operation: (transaction: Prisma.TransactionClient, report: RoadmapChangeReporter) => Promise<T>,
  { isolation = 'serializable', timeout, conflictMessage }: ChangeTransactionOptions = {},
): Promise<T> {
  let deliveries: { changes: RoadmapChanges; deliver: () => void | Promise<void> }[] = [];
  const attempt = (transaction: Prisma.TransactionClient) => {
    deliveries = [];
    return operation(transaction, async (changes) => {
      const deliver = await port.report(transaction, changes);
      if (deliver) deliveries.push({ changes, deliver });
    });
  };
  const result =
    isolation === 'read-committed'
      ? await prisma.$transaction(attempt, timeout ? { timeout } : undefined)
      : await serializableTransaction(attempt, timeout, conflictMessage);
  for (const { changes, deliver } of deliveries) {
    try {
      await deliver();
    } catch (error) {
      console.error('Roadmap change delivery failed', {
        roadmapId: changes.roadmapId,
        actorId: changes.actorId,
        factKinds: [...new Set(changes.facts.map(({ kind }) => kind))],
        error,
      });
    }
  }
  return result;
}

async function serializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  timeout?: number,
  conflictMessage?: string,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          await preferIndexScans(transaction);
          return operation(transaction);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout },
      );
    } catch (error) {
      if (!isSerializationFailure(error)) throw error;
      if (attempt === SERIALIZABLE_MAX_ATTEMPTS - 1) throw conflict(conflictMessage);
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

/**
 * `update` serialises changes to the Roadmap's content. `key-share` records participant
 * progress (Completion, Canvas preview): it lets progress run concurrently and still
 * conflicts with the Roadmap closure's FOR UPDATE.
 */
export type RoadmapLock = 'update' | 'key-share';

/**
 * Locks the Roadmap row. Taking it before any Node row keeps the parent-before-Node
 * order that Completion's KEY SHARE lock and notice delivery follow, so baseline
 * capture and Node deletion cannot invert it through foreign-key locks.
 */
export async function lockRoadmap(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  lock: RoadmapLock,
) {
  if (lock === 'update')
    await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${roadmapId}::uuid FOR UPDATE`;
  else
    await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${roadmapId}::uuid FOR KEY SHARE`;
}

/**
 * Whose Node access a change can affect: every active participant (`roadmap`), only the
 * actor (`actor`, Completion), or nobody (`none`, which skips both snapshots).
 */
export type AccessScope = 'roadmap' | 'actor' | 'none';

export type RoadmapChangeTarget = Readonly<{
  roadmapId: string;
  identifier: Readonly<CourseOfferingIdentifier>;
  actorId: string;
  access: AccessScope;
  lock: RoadmapLock;
}>;

export type Roadmap = Prisma.RoadmapGetPayload<true>;

export type RoadmapChangeOutcome<Result> = { result: Result; facts: RoadmapChangeFact[] };

/**
 * Changes one Roadmap inside a change transaction: locks it, refuses a closed Roadmap
 * on the state read under the lock, runs `change` between the access snapshots its scope
 * needs, and reports its content facts and access facts once.
 */
export async function changeRoadmap<Result>(
  transaction: Prisma.TransactionClient,
  report: RoadmapChangeReporter,
  { roadmapId, identifier, actorId, access, lock }: RoadmapChangeTarget,
  change: (roadmap: Roadmap) => Promise<RoadmapChangeOutcome<Result>>,
): Promise<Result> {
  await lockRoadmap(transaction, roadmapId, lock);
  const roadmap = await transaction.roadmap.findUnique({ where: { id: roadmapId } });
  if (!roadmap) throw roadmapNotFound();
  if (roadmap.closedAt) throw roadmapClosed();
  const snapshot = () =>
    readAccessSnapshot(transaction, roadmapId, access === 'actor' ? actorId : undefined);
  const before = access === 'none' ? null : await snapshot();
  const { result, facts } = await change(roadmap);
  const accessFacts = before ? accessChanges(before, await snapshot()) : [];
  const reported = [...facts, ...accessFacts];
  if (reported.length) await report({ actorId, identifier, roadmapId, facts: reported });
  return result;
}
