import type { RoadmapChangePort } from './change-port';
import { roadmapChangeTransaction } from './change-transaction';
import { serializableTransaction } from './serializable';
import { accessChanges } from './access-changes';
import { readAccessSnapshot } from './access-snapshot';
import 'server-only';

import { Prisma, prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier, StudentNodeAccess } from '@/features/roadmap/types';
import { ApplicationError } from '@/shared/errors/server';
import { blockedNodeAccessMessage } from '@/features/roadmap/domain/access';
import type { RoadmapCapability } from '@/features/roadmap/domain/roadmap-capability';
import { requireRoadmapCapability, roadmapNotFound } from './roadmap-command/errors';
import {
  loadRoadmapProjectionData,
  loadCompletedNodeIds,
  loadStudentNodeAccess,
  projectStudentRoadmap,
  projectTeacherRoadmap,
} from '@/features/roadmap/application/completion-projection';

type ParticipantRoadmapInput = { userId: string; identifier: CourseOfferingIdentifier };
type CompleteNodeInput = ParticipantRoadmapInput & { nodeId: string };
type StudentNodeAccessInput = { userId: string; roadmapId: string; nodeId: string };

function blockedNodeAccessError(access: Extract<StudentNodeAccess, { status: 'BLOCKED' }>) {
  return new ApplicationError(403, access.reason, blockedNodeAccessMessage(access));
}

async function requireNodeAccess(
  transaction: Prisma.TransactionClient,
  {
    roadmapId,
    nodeId,
    completedNodeIds,
  }: { roadmapId: string; nodeId: string; completedNodeIds: ReadonlySet<string> },
) {
  const { nodes, accessByNodeId } = await loadStudentNodeAccess(transaction, {
    roadmapId,
    completedNodeIds,
  });
  if (!nodes.some((node) => node.id === nodeId)) {
    throw new ApplicationError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  }
  const access = accessByNodeId.get(nodeId);
  if (!access || access.status === 'ACCESSIBLE') return;
  throw blockedNodeAccessError(access);
}

export async function requireStudentNodeAccess(
  transaction: Prisma.TransactionClient,
  { userId, roadmapId, nodeId }: StudentNodeAccessInput,
) {
  const completedNodeIds = await loadCompletedNodeIds(transaction, {
    kind: 'COMPLETION',
    userId,
    roadmapId,
  });
  return requireNodeAccess(transaction, {
    roadmapId,
    nodeId,
    completedNodeIds,
  });
}

async function requireParticipantRoadmap(
  transaction: Prisma.TransactionClient,
  { userId, identifier }: ParticipantRoadmapInput,
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

export async function readRoadmapForParticipant({ userId, identifier }: ParticipantRoadmapInput) {
  return prisma.$transaction(
    async (transaction) => {
      const { courseOffering, participation, roadmap } = await requireParticipantRoadmap(
        transaction,
        { userId, identifier },
        'read',
      );
      if (participation.role === 'TEACHER') {
        const data = await loadRoadmapProjectionData(transaction, { courseOffering, roadmap });
        return projectTeacherRoadmap(data, identifier);
      }
      const [data, completedNodeIds] = await Promise.all([
        loadRoadmapProjectionData(transaction, { courseOffering, roadmap }),
        loadCompletedNodeIds(transaction, {
          kind: 'COMPLETION',
          userId,
          roadmapId: roadmap.id,
        }),
      ]);
      return projectStudentRoadmap(data, identifier, completedNodeIds);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

type TeacherRoadmap = Awaited<ReturnType<typeof requireParticipantRoadmap>>;

function withTeacherRoadmapTransaction<Result>(
  { userId, identifier }: ParticipantRoadmapInput,
  operation: (transaction: Prisma.TransactionClient, roadmap: TeacherRoadmap) => Promise<Result>,
) {
  return serializableTransaction(async (transaction) => {
    const roadmap = await requireParticipantRoadmap(transaction, { userId, identifier }, 'edit');
    return operation(transaction, roadmap);
  });
}

export async function completeNode(
  { userId, identifier, nodeId }: CompleteNodeInput,
  changePort: RoadmapChangePort,
) {
  return roadmapChangeTransaction(
    changePort,
    async (transaction, report) => {
      const { roadmap } = await requireParticipantRoadmap(
        transaction,
        { userId, identifier },
        'complete',
      );
      await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${roadmap.id}::uuid FOR KEY SHARE`;
      await requireStudentNodeAccess(transaction, { userId, roadmapId: roadmap.id, nodeId });
      const before = await readAccessSnapshot(transaction, roadmap.id, userId);
      const completion = await transaction.completion.upsert({
        where: { userId_roadmapNodeId: { userId, roadmapNodeId: nodeId } },
        update: {},
        create: { userId, roadmapNodeId: nodeId },
      });
      const after = await readAccessSnapshot(transaction, roadmap.id, userId);
      await report({
        actorId: userId,
        identifier,
        roadmapId: roadmap.id,
        facts: accessChanges(before, after),
      });
      return completion;
    },
    { serializable: true },
  );
}

export async function readSimulatedRoadmap({ userId, identifier }: ParticipantRoadmapInput) {
  return prisma.$transaction(
    async (transaction) => {
      const { courseOffering, participation, roadmap } = await requireParticipantRoadmap(
        transaction,
        { userId, identifier },
        'oversee',
      );
      const [data, completedNodeIds] = await Promise.all([
        loadRoadmapProjectionData(transaction, { courseOffering, roadmap }),
        loadCompletedNodeIds(transaction, {
          kind: 'SIMULATED_COMPLETION',
          participationId: participation.id,
          roadmapId: roadmap.id,
        }),
      ]);
      return projectStudentRoadmap(data, identifier, completedNodeIds);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function completeSimulatedNode({ userId, identifier, nodeId }: CompleteNodeInput) {
  return withTeacherRoadmapTransaction(
    { userId, identifier },
    async (transaction, { courseOffering, participation, roadmap }) => {
      const completedNodeIds = await loadCompletedNodeIds(transaction, {
        kind: 'SIMULATED_COMPLETION',
        participationId: participation.id,
        roadmapId: roadmap.id,
      });
      await requireNodeAccess(transaction, {
        roadmapId: roadmap.id,
        nodeId,
        completedNodeIds,
      });
      // ON CONFLICT DO NOTHING, not an upsert: when a concurrent request inserts the same
      // simulated Completion first, an upsert fails with a unique violation (P2002, a 409),
      // while this raises a serialization failure that `serializableTransaction` retries.
      await transaction.simulatedCompletion.createMany({
        data: {
          participationId: participation.id,
          courseOfferingId: courseOffering.id,
          roadmapId: roadmap.id,
          roadmapNodeId: nodeId,
        },
        skipDuplicates: true,
      });
      return transaction.simulatedCompletion.findUniqueOrThrow({
        where: {
          participationId_roadmapNodeId: {
            participationId: participation.id,
            roadmapNodeId: nodeId,
          },
        },
      });
    },
  );
}

export async function resetSimulatedCompletions({ userId, identifier }: ParticipantRoadmapInput) {
  return withTeacherRoadmapTransaction(
    { userId, identifier },
    async (transaction, { participation, roadmap }) =>
      transaction.simulatedCompletion.deleteMany({
        where: { participationId: participation.id, roadmapId: roadmap.id },
      }),
  );
}
