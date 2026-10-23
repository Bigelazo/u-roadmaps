import 'server-only';
import { Prisma, prisma } from '@/shared/server/db';
import type { ApplicationError } from '@/shared/errors/server';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import {
  decideRoadmapCapability,
  participationGrants,
  type CapabilityParticipation,
  type CapabilityRoadmap,
  type RoadmapCapability,
  type RoadmapRefusal,
} from '@/features/roadmap/domain/roadmap-capability';
import type { RoadmapChangePort } from '../change-port';
import {
  changeRoadmap,
  roadmapChangeTransaction,
  type AccessScope,
  type Roadmap,
  type RoadmapChangeOutcome,
  type RoadmapLock,
} from './change';
import { forbidden, roadmapClosed, roadmapNotFound } from '../errors';

export type RoadmapParticipant = Readonly<{
  userId: string;
  identifier: CourseOfferingIdentifier;
}>;

type Participation = Prisma.ParticipationGetPayload<true>;

const REFUSAL_ERRORS: Readonly<Record<RoadmapRefusal, () => ApplicationError>> = {
  ROADMAP_NOT_FOUND: roadmapNotFound,
  FORBIDDEN: () => forbidden(),
  ROADMAP_CLOSED: () => roadmapClosed(),
};

function requireRoadmapCapability<
  Participation extends CapabilityParticipation,
  Roadmap extends CapabilityRoadmap,
>(input: {
  capability: RoadmapCapability;
  participation: Participation | null;
  roadmap: Roadmap | null;
}) {
  const decision = decideRoadmapCapability(input);
  if (decision.kind === 'REJECTED') throw REFUSAL_ERRORS[decision.reason]();
  return decision;
}

export type RoadmapCommandContext<Parsed> = Readonly<{
  tx: Prisma.TransactionClient;
  roadmap: Roadmap;
  participation: Participation;
  actor: RoadmapParticipant;
  input: Parsed;
}>;

export type RoadmapCommand<Input, Parsed, Result> = Readonly<{
  capability: Extract<RoadmapCapability, 'complete' | 'edit'>;
  parse: (input: Input) => Parsed;
  access: AccessScope | ((input: Parsed) => AccessScope);
  lock?: RoadmapLock;
  conflictMessage?: string;
  run: (context: RoadmapCommandContext<Parsed>) => Promise<RoadmapChangeOutcome<Result>>;
}>;

async function resolveParticipant(
  transaction: Prisma.TransactionClient,
  { userId, identifier }: RoadmapParticipant,
) {
  const courseOffering = await transaction.courseOffering.findUnique({
    where: { courseCode_year_semester: identifier },
    include: { course: true, roadmap: true },
  });
  if (!courseOffering) throw roadmapNotFound();
  const participation = await transaction.participation.findUnique({
    where: { userId_courseOfferingId: { userId, courseOfferingId: courseOffering.id } },
  });
  return { courseOffering, participation };
}

async function resolveParticipantRoadmap(
  transaction: Prisma.TransactionClient,
  participant: RoadmapParticipant,
  capability: RoadmapCapability,
) {
  const { courseOffering, participation } = await resolveParticipant(transaction, participant);
  const allowed = requireRoadmapCapability({
    capability,
    participation,
    roadmap: courseOffering.roadmap,
  });
  return { courseOffering, participation: allowed.participation, roadmap: allowed.roadmap };
}

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

export type RoadmapReadContext<ReadRoadmap extends Roadmap | null = Roadmap> = Readonly<{
  tx: Prisma.TransactionClient;
  courseOffering: Awaited<ReturnType<typeof resolveParticipant>>['courseOffering'];
  participation: Participation;
  roadmap: ReadRoadmap;
}>;

export function roadmapRead<T>(
  participant: RoadmapParticipant,
  capability: RoadmapCapability,
  read: (context: RoadmapReadContext) => Promise<T>,
): Promise<T>;
export function roadmapRead<T>(
  participant: RoadmapParticipant,
  capability: RoadmapCapability,
  read: (context: RoadmapReadContext<Roadmap | null>) => Promise<T>,
  options: { roadmap: 'optional' },
): Promise<T>;
export function roadmapRead<T>(
  participant: RoadmapParticipant,
  capability: RoadmapCapability,
  read: (context: RoadmapReadContext) => Promise<T>,
  options?: { roadmap: 'optional' },
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      const { courseOffering, participation } = await resolveParticipant(tx, participant);
      if (options && !courseOffering.roadmap) {
        if (!participationGrants(participation, capability)) throw forbidden();
        const readOffering = read as (context: RoadmapReadContext<Roadmap | null>) => Promise<T>;
        return readOffering({ tx, courseOffering, participation, roadmap: null });
      }
      const allowed = requireRoadmapCapability({
        capability,
        participation,
        roadmap: courseOffering.roadmap,
      });
      return read({
        tx,
        courseOffering,
        participation: allowed.participation,
        roadmap: allowed.roadmap,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
