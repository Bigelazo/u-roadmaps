import 'server-only';

import { Prisma, prisma } from '@/shared/server/db';
import {
  ApiError,
  apiResult,
  nodeDto,
  resourceDto,
} from '@/features/roadmap/application/roadmap';
import type { CourseOfferingIdentifier, StudentNodeAccess } from '@/features/roadmap/types';
import { studentNodeAccessById } from '@/features/roadmap/domain/access';

type ParticipantRoadmapInput = {
  userId: string;
  identifier: CourseOfferingIdentifier;
};

type CompleteNodeInput = ParticipantRoadmapInput & {
  nodeId: string;
};

type StudentNodeAccessInput = {
  userId: string;
  roadmapId: string;
  nodeId: string;
};

function blockedNodeAccessError(access: Extract<StudentNodeAccess, { status: 'BLOCKED' }>) {
  return new ApiError(
    403,
    access.reason,
    access.reason === 'TEACHER_BLOCK'
      ? 'El equipo docente bloqueó este nodo.'
      : 'Este nodo permanece bloqueado por sus prerrequisitos.',
  );
}

export async function requireStudentNodeAccess(
  transaction: Prisma.TransactionClient,
  { userId, roadmapId, nodeId }: StudentNodeAccessInput,
) {
  const [nodes, dependencies, completions] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId, isVisible: true },
      select: { id: true, isTeacherBlocked: true },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
    transaction.completion.findMany({
      where: { userId, roadmapNode: { roadmapId } },
      select: { roadmapNodeId: true },
    }),
  ]);
  if (!nodes.some((node) => node.id === nodeId)) {
    throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  }
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const access = studentNodeAccessById({
    nodes,
    dependencies: dependencies.filter(
      (dependency) =>
        visibleNodeIds.has(dependency.sourceNodeId) && visibleNodeIds.has(dependency.targetNodeId),
    ),
    completedNodeIds: new Set(completions.map(({ roadmapNodeId }) => roadmapNodeId)),
  }).get(nodeId);
  if (!access || access.status === 'ACCESSIBLE') return;
  throw blockedNodeAccessError(access);
}

async function requireParticipantRoadmap(
  transaction: Prisma.TransactionClient,
  { userId, identifier }: ParticipantRoadmapInput,
  requiredRole?: 'STUDENT',
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

async function readRoadmapForParticipantUnsafe({ userId, identifier }: ParticipantRoadmapInput) {
  return prisma.$transaction(
    async (transaction) => {
      const { courseOffering, participation, roadmap } = await requireParticipantRoadmap(
        transaction,
        { userId, identifier },
      );
      const includeHidden = participation.role === 'TEACHER';
      const [predefinedNodeTypes, customNodeTypes, roadmapNodes, dependencies, completions] =
        await Promise.all([
          transaction.nodeType.findMany({
            where: { isPredefined: true },
            orderBy: { name: 'asc' },
          }),
          transaction.nodeType.findMany({
            where: { roadmapId: roadmap.id },
            orderBy: { name: 'asc' },
          }),
          transaction.roadmapNode.findMany({
            where: { roadmapId: roadmap.id },
            orderBy: { title: 'asc' },
            include: { resources: { orderBy: { title: 'asc' } } },
          }),
          transaction.dependency.findMany({
            where: { sourceNode: { roadmapId: roadmap.id } },
            orderBy: { id: 'asc' },
          }),
          participation.role === 'STUDENT'
            ? transaction.completion.findMany({
                where: { userId, roadmapNode: { roadmapId: roadmap.id } },
                select: { roadmapNodeId: true },
              })
            : Promise.resolve([]),
        ]);
      const nodes = includeHidden ? roadmapNodes : roadmapNodes.filter((node) => node.isVisible);
      const visibleNodeIds = new Set(nodes.map((node) => node.id));
      const visibleDependencies = dependencies.filter(
        (dependency) =>
          includeHidden ||
          (visibleNodeIds.has(dependency.sourceNodeId) &&
            visibleNodeIds.has(dependency.targetNodeId)),
      );
      const completedNodeIds = new Set(completions.map(({ roadmapNodeId }) => roadmapNodeId));
      const accessByNodeId =
        participation.role === 'STUDENT'
          ? studentNodeAccessById({
              nodes,
              dependencies: visibleDependencies,
              completedNodeIds,
            })
          : undefined;

      return {
        course: {
          code: courseOffering.course.code,
          name: courseOffering.course.name,
          department: courseOffering.course.department,
        },
        courseOffering: {
          id: courseOffering.id,
          year: courseOffering.year,
          semester: courseOffering.semester,
        },
        roadmap: { id: roadmap.id },
        nodeTypes: [...predefinedNodeTypes, ...customNodeTypes].map((type) => ({
          id: type.id,
          name: type.name,
          color: type.color,
          isPredefined: type.isPredefined,
        })),
        nodes: nodes.map((node) => {
          const isCompleted = completedNodeIds.has(node.id);
          const access = accessByNodeId?.get(node.id);
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
            ...(participation.role === 'STUDENT'
              ? {
                  access,
                  isCompleted,
                  canComplete: !isCompleted,
                }
              : {}),
            resources: node.resources.map((resource) => resourceDto(resource, identifier)),
          };
        }),
        dependencies: visibleDependencies.map((dependency) => ({
          id: dependency.id,
          sourceNodeId: dependency.sourceNodeId,
          targetNodeId: dependency.targetNodeId,
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

async function completeNodeUnsafe({ userId, identifier, nodeId }: CompleteNodeInput) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const { roadmap } = await requireParticipantRoadmap(
            transaction,
            { userId, identifier },
            'STUDENT',
          );
          await requireStudentNodeAccess(transaction, { userId, roadmapId: roadmap.id, nodeId });
          const existing = await transaction.completion.findUnique({
            where: { userId_roadmapNodeId: { userId, roadmapNodeId: nodeId } },
          });
          if (existing) return existing;

          return transaction.completion.upsert({
            where: { userId_roadmapNodeId: { userId, roadmapNodeId: nodeId } },
            update: {},
            create: { userId, roadmapNodeId: nodeId },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        attempt < 2 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('Completion transaction retry limit reached.');
}

export function readRoadmapForParticipant(input: ParticipantRoadmapInput) {
  return apiResult(() => readRoadmapForParticipantUnsafe(input));
}

export function completeNode(input: CompleteNodeInput) {
  return apiResult(() => completeNodeUnsafe(input));
}
