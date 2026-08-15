import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { ApiError, type CourseOfferingIdentifier, nodeDto } from '@/lib/roadmap-api';

type ParticipantRoadmapInput = {
  userId: string;
  identifier: CourseOfferingIdentifier;
};

type CompleteNodeInput = ParticipantRoadmapInput & {
  nodeId: string;
};

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

export async function readRoadmapForParticipant({ userId, identifier }: ParticipantRoadmapInput) {
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
      const prerequisiteIdsByTarget = new Map<string, string[]>();
      for (const dependency of visibleDependencies) {
        const prerequisites = prerequisiteIdsByTarget.get(dependency.targetNodeId) ?? [];
        prerequisites.push(dependency.sourceNodeId);
        prerequisiteIdsByTarget.set(dependency.targetNodeId, prerequisites);
      }

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
          const prerequisites = prerequisiteIdsByTarget.get(node.id) ?? [];
          return {
            ...nodeDto(node),
            ...(participation.role === 'STUDENT'
              ? {
                  isCompleted,
                  canComplete:
                    !isCompleted &&
                    prerequisites.every((prerequisiteId) => completedNodeIds.has(prerequisiteId)),
                }
              : {}),
            resources: node.resources.map((resource) => ({
              id: resource.id,
              title: resource.title,
              url: resource.url,
              type: resource.type,
            })),
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

export async function completeNode({ userId, identifier, nodeId }: CompleteNodeInput) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const { roadmap } = await requireParticipantRoadmap(
            transaction,
            { userId, identifier },
            'STUDENT',
          );
          const node = await transaction.roadmapNode.findFirst({
            where: { id: nodeId, roadmapId: roadmap.id, isVisible: true },
          });
          if (!node) {
            throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
          }
          const existing = await transaction.completion.findUnique({
            where: { userId_roadmapNodeId: { userId, roadmapNodeId: node.id } },
          });
          if (existing) return existing;

          const prerequisites = await transaction.dependency.findMany({
            where: { targetNodeId: node.id, sourceNode: { isVisible: true } },
            select: { sourceNodeId: true },
          });
          const completedPrerequisites = await transaction.completion.count({
            where: {
              userId,
              roadmapNodeId: { in: prerequisites.map(({ sourceNodeId }) => sourceNodeId) },
            },
          });
          if (completedPrerequisites !== prerequisites.length) {
            throw new ApiError(
              409,
              'PREREQUISITES_PENDING',
              'Debes completar los prerrequisitos visibles antes de este nodo.',
            );
          }

          return transaction.completion.upsert({
            where: { userId_roadmapNodeId: { userId, roadmapNodeId: node.id } },
            update: {},
            create: { userId, roadmapNodeId: node.id },
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
