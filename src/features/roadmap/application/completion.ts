import 'server-only';

import { Prisma, prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier, StudentNodeAccess } from '@/features/roadmap/types';
import { ApplicationError, applicationResult } from '@/shared/errors/server';
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
type RequiredRole = 'STUDENT' | 'TEACHER';

function blockedNodeAccessError(access: Extract<StudentNodeAccess, { status: 'BLOCKED' }>) {
  return new ApplicationError(
    403,
    access.reason,
    access.reason === 'TEACHER_BLOCK'
      ? 'El equipo docente bloqueó este nodo.'
      : 'Este nodo permanece bloqueado por sus prerrequisitos.',
  );
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
  requiredRole?: RequiredRole,
) {
  const courseOffering = await transaction.courseOffering.findUnique({
    where: { courseCode_year_semester: identifier },
    include: { course: true, roadmap: true },
  });
  if (!courseOffering) {
    throw new ApplicationError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  const participation = await transaction.participation.findUnique({
    where: { userId_courseOfferingId: { userId, courseOfferingId: courseOffering.id } },
  });
  if (!participation?.isActive || (requiredRole && participation.role !== requiredRole)) {
    throw new ApplicationError(
      403,
      'FORBIDDEN',
      'No tienes participación vigente para esta operación.',
    );
  }
  if (!courseOffering.roadmap) {
    throw new ApplicationError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  return { courseOffering, participation, roadmap: courseOffering.roadmap };
}

async function requireCurrentRoadmap(
  transaction: Prisma.TransactionClient,
  courseOffering: { year: number; semester: number },
) {
  const academicTerm = await transaction.academicTerm.findUnique({
    where: {
      year_semester: { year: courseOffering.year, semester: courseOffering.semester },
    },
    select: { roadmapFreezeDate: true },
  });
  if (academicTerm && academicTerm.roadmapFreezeDate.getTime() <= Date.now()) {
    throw new ApplicationError(403, 'ROADMAP_FROZEN', 'Este roadmap histórico es de sólo lectura.');
  }
}

async function readRoadmapForParticipantUnsafe({ userId, identifier }: ParticipantRoadmapInput) {
  return prisma.$transaction(
    async (transaction) => {
      const { courseOffering, participation, roadmap } = await requireParticipantRoadmap(
        transaction,
        { userId, identifier },
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

async function withSerializableRetry<Result>(operation: () => Promise<Result>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        attempt < 2 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        continue;
      throw error;
    }
  }
  throw new Error('Completion transaction retry limit reached.');
}

type TeacherRoadmap = Awaited<ReturnType<typeof requireParticipantRoadmap>>;

function withTeacherRoadmapTransaction<Result>(
  { userId, identifier }: ParticipantRoadmapInput,
  operation: (transaction: Prisma.TransactionClient, roadmap: TeacherRoadmap) => Promise<Result>,
) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (transaction) => {
        const roadmap = await requireParticipantRoadmap(
          transaction,
          { userId, identifier },
          'TEACHER',
        );
        await requireCurrentRoadmap(transaction, roadmap.courseOffering);
        return operation(transaction, roadmap);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

async function completeNodeUnsafe({ userId, identifier, nodeId }: CompleteNodeInput) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (transaction) => {
        const { courseOffering, roadmap } = await requireParticipantRoadmap(
          transaction,
          { userId, identifier },
          'STUDENT',
        );
        await requireCurrentRoadmap(transaction, courseOffering);
        await requireStudentNodeAccess(transaction, { userId, roadmapId: roadmap.id, nodeId });
        return transaction.completion.upsert({
          where: { userId_roadmapNodeId: { userId, roadmapNodeId: nodeId } },
          update: {},
          create: { userId, roadmapNodeId: nodeId },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

async function readSimulatedRoadmapUnsafe({ userId, identifier }: ParticipantRoadmapInput) {
  return prisma.$transaction(
    async (transaction) => {
      const { courseOffering, participation, roadmap } = await requireParticipantRoadmap(
        transaction,
        { userId, identifier },
        'TEACHER',
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

async function completeSimulatedNodeUnsafe({ userId, identifier, nodeId }: CompleteNodeInput) {
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
      return transaction.simulatedCompletion.upsert({
        where: {
          participationId_roadmapNodeId: {
            participationId: participation.id,
            roadmapNodeId: nodeId,
          },
        },
        update: {},
        create: {
          participationId: participation.id,
          courseOfferingId: courseOffering.id,
          roadmapId: roadmap.id,
          roadmapNodeId: nodeId,
        },
      });
    },
  );
}

async function resetSimulatedCompletionsUnsafe({ userId, identifier }: ParticipantRoadmapInput) {
  return withTeacherRoadmapTransaction(
    { userId, identifier },
    async (transaction, { participation, roadmap }) =>
      transaction.simulatedCompletion.deleteMany({
        where: { participationId: participation.id, roadmapId: roadmap.id },
      }),
  );
}

export function readRoadmapForParticipant(input: ParticipantRoadmapInput) {
  return applicationResult(() => readRoadmapForParticipantUnsafe(input));
}

export function completeNode(input: CompleteNodeInput) {
  return applicationResult(() => completeNodeUnsafe(input));
}

export function readSimulatedRoadmap(input: ParticipantRoadmapInput) {
  return applicationResult(() => readSimulatedRoadmapUnsafe(input));
}

export function completeSimulatedNode(input: CompleteNodeInput) {
  return applicationResult(() => completeSimulatedNodeUnsafe(input));
}

export function resetSimulatedCompletions(input: ParticipantRoadmapInput) {
  return applicationResult(() => resetSimulatedCompletionsUnsafe(input));
}
