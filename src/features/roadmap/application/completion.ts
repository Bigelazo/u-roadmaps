import 'server-only';

import { Prisma, prisma } from '@/shared/server/db';
import { ApiError, apiResult, nodeDto, resourceDto } from '@/features/roadmap/application/roadmap';
import type { CourseOfferingIdentifier, StudentNodeAccess } from '@/features/roadmap/types';
import { studentNodeAccessById } from '@/features/roadmap/domain/access';

type ParticipantRoadmapInput = { userId: string; identifier: CourseOfferingIdentifier };
type CompleteNodeInput = ParticipantRoadmapInput & { nodeId: string };
type StudentNodeAccessInput = { userId: string; roadmapId: string; nodeId: string };
type RequiredRole = 'STUDENT' | 'TEACHER';

function blockedNodeAccessError(access: Extract<StudentNodeAccess, { status: 'BLOCKED' }>) {
  return new ApiError(
    403,
    access.reason,
    access.reason === 'TEACHER_BLOCK'
      ? 'El equipo docente bloqueó este nodo.'
      : 'Este nodo permanece bloqueado por sus prerrequisitos.',
  );
}

async function nodeAccessById(
  transaction: Prisma.TransactionClient,
  { roadmapId, completedNodeIds }: { roadmapId: string; completedNodeIds: ReadonlySet<string> },
) {
  const [nodes, dependencies] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId, isVisible: true },
      select: { id: true, isTeacherBlocked: true },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
  ]);
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    accessByNodeId: studentNodeAccessById({
      nodes,
      dependencies: dependencies.filter(
        (dependency) =>
          visibleNodeIds.has(dependency.sourceNodeId) &&
          visibleNodeIds.has(dependency.targetNodeId),
      ),
      completedNodeIds,
    }),
  };
}

async function requireNodeAccess(
  transaction: Prisma.TransactionClient,
  {
    roadmapId,
    nodeId,
    completedNodeIds,
  }: { roadmapId: string; nodeId: string; completedNodeIds: ReadonlySet<string> },
) {
  const { nodes, accessByNodeId } = await nodeAccessById(transaction, {
    roadmapId,
    completedNodeIds,
  });
  if (!nodes.some((node) => node.id === nodeId)) {
    throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  }
  const access = accessByNodeId.get(nodeId);
  if (!access || access.status === 'ACCESSIBLE') return;
  throw blockedNodeAccessError(access);
}

export async function requireStudentNodeAccess(
  transaction: Prisma.TransactionClient,
  { userId, roadmapId, nodeId }: StudentNodeAccessInput,
) {
  const completions = await transaction.completion.findMany({
    where: { userId, roadmapNode: { roadmapId } },
    select: { roadmapNodeId: true },
  });
  return requireNodeAccess(transaction, {
    roadmapId,
    nodeId,
    completedNodeIds: new Set(completions.map(({ roadmapNodeId }) => roadmapNodeId)),
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
    throw new ApiError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  const participation = await transaction.participation.findUnique({
    where: { userId_courseOfferingId: { userId, courseOfferingId: courseOffering.id } },
  });
  if (!participation?.isActive || (requiredRole && participation.role !== requiredRole)) {
    throw new ApiError(403, 'FORBIDDEN', 'No tienes participación vigente para esta operación.');
  }
  if (!courseOffering.roadmap) {
    throw new ApiError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  return { courseOffering, participation, roadmap: courseOffering.roadmap };
}

async function studentRoadmapProjection(
  transaction: Prisma.TransactionClient,
  {
    courseOffering,
    roadmap,
    identifier,
    completedNodeIds,
  }: {
    courseOffering: {
      id: string;
      year: number;
      semester: number;
      course: { code: string; name: string; department: string };
    };
    roadmap: { id: string };
    identifier: CourseOfferingIdentifier;
    completedNodeIds: ReadonlySet<string>;
  },
) {
  const [predefinedNodeTypes, customNodeTypes, roadmapNodes, dependencies] = await Promise.all([
    transaction.nodeType.findMany({ where: { isPredefined: true }, orderBy: { name: 'asc' } }),
    transaction.nodeType.findMany({ where: { roadmapId: roadmap.id }, orderBy: { name: 'asc' } }),
    transaction.roadmapNode.findMany({
      where: { roadmapId: roadmap.id, isVisible: true },
      orderBy: { title: 'asc' },
      include: { resources: { orderBy: { title: 'asc' } } },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId: roadmap.id } },
      orderBy: { id: 'asc' },
    }),
  ]);
  const visibleNodeIds = new Set(roadmapNodes.map((node) => node.id));
  const visibleDependencies = dependencies.filter(
    (dependency) =>
      visibleNodeIds.has(dependency.sourceNodeId) && visibleNodeIds.has(dependency.targetNodeId),
  );
  const accessByNodeId = studentNodeAccessById({
    nodes: roadmapNodes,
    dependencies: visibleDependencies,
    completedNodeIds,
  });
  return {
    course: courseOffering.course,
    courseOffering: {
      id: courseOffering.id,
      year: courseOffering.year,
      semester: courseOffering.semester,
    },
    roadmap: { id: roadmap.id },
    nodeTypes: [...predefinedNodeTypes, ...customNodeTypes].map((type) => ({
      id: type.id,
      name: type.name,
      icon: type.icon,
      color: type.color,
      isPredefined: type.isPredefined,
    })),
    nodes: roadmapNodes.map((node) => {
      const isCompleted = completedNodeIds.has(node.id);
      const access = accessByNodeId.get(node.id);
      if (access?.status === 'BLOCKED') {
        return {
          id: node.id,
          title: node.title,
          positionX: node.positionX,
          positionY: node.positionY,
          nodeTypeId: node.nodeTypeId,
          access,
        };
      }
      return {
        ...nodeDto(node),
        access,
        isCompleted,
        canComplete: !isCompleted,
        resources: node.resources.map((resource) => resourceDto(resource, identifier)),
      };
    }),
    dependencies: visibleDependencies.map((dependency) => ({
      id: dependency.id,
      sourceNodeId: dependency.sourceNodeId,
      targetNodeId: dependency.targetNodeId,
    })),
  };
}

async function teacherRoadmapProjection(
  transaction: Prisma.TransactionClient,
  {
    courseOffering,
    roadmap,
    identifier,
  }: {
    courseOffering: {
      id: string;
      year: number;
      semester: number;
      course: { code: string; name: string; department: string };
    };
    roadmap: { id: string };
    identifier: CourseOfferingIdentifier;
  },
) {
  const [predefinedNodeTypes, customNodeTypes, roadmapNodes, dependencies] = await Promise.all([
    transaction.nodeType.findMany({ where: { isPredefined: true }, orderBy: { name: 'asc' } }),
    transaction.nodeType.findMany({ where: { roadmapId: roadmap.id }, orderBy: { name: 'asc' } }),
    transaction.roadmapNode.findMany({
      where: { roadmapId: roadmap.id },
      orderBy: { title: 'asc' },
      include: { resources: { orderBy: { title: 'asc' } } },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId: roadmap.id } },
      orderBy: { id: 'asc' },
    }),
  ]);
  return {
    course: courseOffering.course,
    courseOffering: {
      id: courseOffering.id,
      year: courseOffering.year,
      semester: courseOffering.semester,
    },
    roadmap: { id: roadmap.id },
    nodeTypes: [...predefinedNodeTypes, ...customNodeTypes].map((type) => ({
      id: type.id,
      name: type.name,
      icon: type.icon,
      color: type.color,
      isPredefined: type.isPredefined,
    })),
    nodes: roadmapNodes.map((node) => ({
      ...nodeDto(node),
      resources: node.resources.map((resource) => resourceDto(resource, identifier)),
    })),
    dependencies: dependencies.map((dependency) => ({
      id: dependency.id,
      sourceNodeId: dependency.sourceNodeId,
      targetNodeId: dependency.targetNodeId,
    })),
  };
}

async function readRoadmapForParticipantUnsafe({ userId, identifier }: ParticipantRoadmapInput) {
  return prisma.$transaction(
    async (transaction) => {
      const { courseOffering, participation, roadmap } = await requireParticipantRoadmap(
        transaction,
        { userId, identifier },
      );
      if (participation.role === 'TEACHER') {
        return teacherRoadmapProjection(transaction, { courseOffering, roadmap, identifier });
      }
      const completions = await transaction.completion.findMany({
        where: { userId, roadmapNode: { roadmapId: roadmap.id } },
        select: { roadmapNodeId: true },
      });
      return studentRoadmapProjection(transaction, {
        courseOffering,
        roadmap,
        identifier,
        completedNodeIds: new Set(completions.map(({ roadmapNodeId }) => roadmapNodeId)),
      });
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

async function completeNodeUnsafe({ userId, identifier, nodeId }: CompleteNodeInput) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (transaction) => {
        const { roadmap } = await requireParticipantRoadmap(
          transaction,
          { userId, identifier },
          'STUDENT',
        );
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
      const completions = await transaction.simulatedCompletion.findMany({
        where: { participationId: participation.id, roadmapId: roadmap.id },
        select: { roadmapNodeId: true },
      });
      return studentRoadmapProjection(transaction, {
        courseOffering,
        roadmap,
        identifier,
        completedNodeIds: new Set(completions.map(({ roadmapNodeId }) => roadmapNodeId)),
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

async function completeSimulatedNodeUnsafe({ userId, identifier, nodeId }: CompleteNodeInput) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (transaction) => {
        const { courseOffering, participation, roadmap } = await requireParticipantRoadmap(
          transaction,
          { userId, identifier },
          'TEACHER',
        );
        const completions = await transaction.simulatedCompletion.findMany({
          where: { participationId: participation.id, roadmapId: roadmap.id },
          select: { roadmapNodeId: true },
        });
        await requireNodeAccess(transaction, {
          roadmapId: roadmap.id,
          nodeId,
          completedNodeIds: new Set(completions.map(({ roadmapNodeId }) => roadmapNodeId)),
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
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

async function resetSimulatedCompletionsUnsafe({ userId, identifier }: ParticipantRoadmapInput) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (transaction) => {
        const { participation, roadmap } = await requireParticipantRoadmap(
          transaction,
          { userId, identifier },
          'TEACHER',
        );
        return transaction.simulatedCompletion.deleteMany({
          where: { participationId: participation.id, roadmapId: roadmap.id },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export function readRoadmapForParticipant(input: ParticipantRoadmapInput) {
  return apiResult(() => readRoadmapForParticipantUnsafe(input));
}

export function completeNode(input: CompleteNodeInput) {
  return apiResult(() => completeNodeUnsafe(input));
}

export function readSimulatedRoadmap(input: ParticipantRoadmapInput) {
  return apiResult(() => readSimulatedRoadmapUnsafe(input));
}

export function completeSimulatedNode(input: CompleteNodeInput) {
  return apiResult(() => completeSimulatedNodeUnsafe(input));
}

export function resetSimulatedCompletions(input: ParticipantRoadmapInput) {
  return apiResult(() => resetSimulatedCompletionsUnsafe(input));
}
