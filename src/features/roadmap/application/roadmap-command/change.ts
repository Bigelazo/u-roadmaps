import 'server-only';
import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import type { RoadmapChangeFact, RoadmapChangePort, RoadmapChanges } from '../change-port';
import { accessChanges } from '../access-changes';
import { readAccessSnapshot } from '../access-snapshot';
import { conflict, roadmapClosed, roadmapNotFound } from '../errors';

const SERIALIZABLE_MAX_ATTEMPTS = 5;

export type RoadmapChangeReporter = (changes: RoadmapChanges) => Promise<void>;

export type ChangeTransactionOptions = Readonly<{
  isolation?: 'serializable' | 'read-committed';
  timeout?: number;
  conflictMessage?: string;
}>;

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
      await delay(50 * 2 ** attempt + Math.random() * 50);
    }
  }
}

async function preferIndexScans(transaction: Prisma.TransactionClient) {
  await transaction.$executeRaw`SET LOCAL enable_seqscan = off`;
}

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

export type RoadmapLock = 'update' | 'key-share';

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
