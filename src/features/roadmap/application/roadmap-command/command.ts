import 'server-only';
import { Prisma, prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import type { RoadmapCapability } from '@/features/roadmap/domain/roadmap-capability';
import type { RoadmapChangePort } from '../change-port';
import {
  changeRoadmap,
  roadmapChangeTransaction,
  type AccessScope,
  type Roadmap,
  type RoadmapChangeOutcome,
  type RoadmapLock,
} from './change';
import { requireRoadmapCapability, roadmapNotFound } from './errors';

/** Who asks, and for which Course offering's Roadmap. */
export type RoadmapParticipant = Readonly<{
  userId: string;
  identifier: CourseOfferingIdentifier;
}>;

type Participation = Prisma.ParticipationGetPayload<true>;

export type RoadmapCommandContext<Parsed> = Readonly<{
  tx: Prisma.TransactionClient;
  /** The Roadmap as read under its lock. */
  roadmap: Roadmap;
  participation: Participation;
  actor: RoadmapParticipant;
  input: Parsed;
}>;

/** A participant's write to an existing Roadmap (ADR-0029). */
export type RoadmapCommand<Input, Parsed, Result> = Readonly<{
  capability: Extract<RoadmapCapability, 'complete' | 'edit'>;
  /** Pure; runs once, before the transaction, so invalid input never waits for the lock. */
  parse: (input: Input) => Parsed;
  /** Required: forgetting it would silently drop Roadmap notices (ADR-0024). */
  access: AccessScope | ((input: Parsed) => AccessScope);
  /** `key-share` for participant progress (Completion, Canvas preview); `update` otherwise. */
  lock?: RoadmapLock;
  /** The message of the 409 once concurrent modifications exhausted every attempt. */
  conflictMessage?: string;
  /** The mutation and its content facts. It never calls the port. */
  run: (context: RoadmapCommandContext<Parsed>) => Promise<RoadmapChangeOutcome<Result>>;
}>;

/**
 * Resolves the participant's Course offering, Roadmap and Participation and decides the
 * capability, without locking. A missing Course offering answers like a missing Roadmap.
 */
async function resolveParticipantRoadmap(
  transaction: Prisma.TransactionClient,
  { userId, identifier }: RoadmapParticipant,
  capability: RoadmapCapability,
) {
  const courseOffering = await transaction.courseOffering.findUnique({
    where: { courseCode_year_semester: identifier },
    include: { course: true, roadmap: true },
  });
  if (!courseOffering) throw roadmapNotFound();
  const participation = await transaction.participation.findUnique({
    where: { userId_courseOfferingId: { userId, courseOfferingId: courseOffering.id } },
  });
  const allowed = requireRoadmapCapability({
    capability,
    participation,
    roadmap: courseOffering.roadmap,
  });
  return { courseOffering, participation: allowed.participation, roadmap: allowed.roadmap };
}

/**
 * Turns a command declaration into the operation every caller runs: parse, then in one
 * serializable change transaction resolve and decide the capability, lock the Roadmap,
 * refuse a closed one, run the command between the access snapshots its scope needs,
 * and report its content and access facts once. Deliveries run after the commit.
 */
export function roadmapCommand<Input, Parsed, Result>(
  command: RoadmapCommand<Input, Parsed, Result>,
) {
  return async (request: RoadmapParticipant & Input, port: RoadmapChangePort): Promise<Result> => {
    const input = command.parse(request);
    const access = typeof command.access === 'function' ? command.access(input) : command.access;
    const actor = { userId: request.userId, identifier: request.identifier };
    return roadmapChangeTransaction(
      port,
      async (tx, report) => {
        const { participation, roadmap } = await resolveParticipantRoadmap(
          tx,
          actor,
          command.capability,
        );
        return changeRoadmap(
          tx,
          report,
          {
            roadmapId: roadmap.id,
            identifier: actor.identifier,
            actorId: actor.userId,
            access,
            lock: command.lock ?? 'update',
          },
          (locked) => command.run({ tx, roadmap: locked, participation, actor, input }),
        );
      },
      { conflictMessage: command.conflictMessage },
    );
  };
}

/**
 * A participant's read of a Roadmap: the same resolution and capability decision as a
 * command, in one REPEATABLE READ snapshot and without a lock.
 */
export function roadmapRead<T>(
  participant: RoadmapParticipant,
  capability: RoadmapCapability,
  read: (
    context: Awaited<ReturnType<typeof resolveParticipantRoadmap>> & {
      tx: Prisma.TransactionClient;
    },
  ) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => read({ tx, ...(await resolveParticipantRoadmap(tx, participant, capability)) }),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
