import 'server-only';

import type { Prisma } from '@/shared/server/db';
import type { StudentNodeAccess } from '@/features/roadmap/types';
import { ApplicationError } from '@/shared/errors/server';
import { blockedNodeAccessMessage } from '@/features/roadmap/domain/access';
import {
  unreviewedResourceIds,
  unreviewedResourcesMessage,
} from '@/features/roadmap/domain/resource-review';
import { requireUuid } from '@/shared/validation';
import { nodeNotFound } from './errors';
import { roadmapCommand, roadmapRead, type RoadmapParticipant } from './roadmap-command';
import {
  loadRoadmapProjectionData,
  loadCompletedNodeIds,
  loadReviewedResourceIds,
  loadStudentNodeAccess,
  projectStudentRoadmap,
  projectTeacherRoadmap,
  type RoadmapCompletionScope,
} from '@/features/roadmap/application/completion-projection';

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
  const accessByNodeId = await loadStudentNodeAccess(transaction, {
    roadmapId,
    completedNodeIds,
  });
  const access = accessByNodeId.get(nodeId);
  if (!access) throw nodeNotFound();
  if (access.status === 'BLOCKED') throw blockedNodeAccessError(access);
}

async function requireReviewedResources(
  transaction: Prisma.TransactionClient,
  scope: RoadmapCompletionScope,
  nodeId: string,
) {
  const [resources, reviewedResourceIds] = await Promise.all([
    transaction.resource.findMany({ where: { roadmapNodeId: nodeId }, select: { id: true } }),
    loadReviewedResourceIds(transaction, scope, nodeId),
  ]);
  const pending = unreviewedResourceIds(
    resources.map(({ id }) => id),
    reviewedResourceIds,
  );
  if (pending.length > 0)
    throw new ApplicationError(409, 'UNREVIEWED_RESOURCES', unreviewedResourcesMessage);
}

async function loadProgress(transaction: Prisma.TransactionClient, scope: RoadmapCompletionScope) {
  const [completedNodeIds, reviewedResourceIds] = await Promise.all([
    loadCompletedNodeIds(transaction, scope),
    loadReviewedResourceIds(transaction, scope),
  ]);
  return { completedNodeIds, reviewedResourceIds };
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

export async function requireCanvasPreviewNodeAccess(
  transaction: Prisma.TransactionClient,
  {
    participationId,
    roadmapId,
    nodeId,
  }: { participationId: string; roadmapId: string; nodeId: string },
) {
  const completedNodeIds = await loadCompletedNodeIds(transaction, {
    kind: 'SIMULATED_COMPLETION',
    participationId,
    roadmapId,
  });
  return requireNodeAccess(transaction, { roadmapId, nodeId, completedNodeIds });
}

export function readRoadmapForParticipant(participant: RoadmapParticipant) {
  return roadmapRead(
    participant,
    'read',
    async ({ tx, courseOffering, participation, roadmap }) => {
      if (participation.role === 'TEACHER') {
        const data = await loadRoadmapProjectionData(tx, { courseOffering, roadmap });
        return projectTeacherRoadmap(data, participant.identifier);
      }
      const [data, progress] = await Promise.all([
        loadRoadmapProjectionData(tx, { courseOffering, roadmap }),
        loadProgress(tx, { kind: 'COMPLETION', userId: participant.userId, roadmapId: roadmap.id }),
      ]);
      return projectStudentRoadmap(data, participant.identifier, progress);
    },
  );
}

export const completeNode = roadmapCommand({
  capability: 'complete',
  lock: 'key-share',
  parse: ({ nodeId }: { nodeId: string }) => requireUuid(nodeId, 'nodeId'),
  access: 'actor',
  run: async ({ tx, roadmap, actor, input: nodeId }) => {
    await requireStudentNodeAccess(tx, { userId: actor.userId, roadmapId: roadmap.id, nodeId });
    const where = { userId_roadmapNodeId: { userId: actor.userId, roadmapNodeId: nodeId } };
    const existing = await tx.completion.findUnique({ where });
    if (existing) return { result: existing, facts: [] };
    await requireReviewedResources(
      tx,
      { kind: 'COMPLETION', userId: actor.userId, roadmapId: roadmap.id },
      nodeId,
    );
    const completion = await tx.completion.upsert({
      where,
      update: {},
      create: { userId: actor.userId, roadmapNodeId: nodeId },
    });
    return { result: completion, facts: [] };
  },
});

export function readSimulatedRoadmap(participant: RoadmapParticipant) {
  return roadmapRead(
    participant,
    'oversee',
    async ({ tx, courseOffering, participation, roadmap }) => {
      const [data, progress] = await Promise.all([
        loadRoadmapProjectionData(tx, { courseOffering, roadmap }),
        loadProgress(tx, {
          kind: 'SIMULATED_COMPLETION',
          participationId: participation.id,
          roadmapId: roadmap.id,
        }),
      ]);
      return projectStudentRoadmap(data, participant.identifier, progress);
    },
  );
}

export const completeSimulatedNode = roadmapCommand({
  capability: 'edit',
  lock: 'key-share',
  parse: ({ nodeId }: { nodeId: string }) => requireUuid(nodeId, 'nodeId'),
  access: 'none',
  run: async ({ tx, roadmap, participation, input: nodeId }) => {
    const scope = {
      kind: 'SIMULATED_COMPLETION',
      participationId: participation.id,
      roadmapId: roadmap.id,
    } as const;
    const completedNodeIds = await loadCompletedNodeIds(tx, scope);
    await requireNodeAccess(tx, { roadmapId: roadmap.id, nodeId, completedNodeIds });
    if (!completedNodeIds.has(nodeId)) await requireReviewedResources(tx, scope, nodeId);
    await tx.simulatedCompletion.createMany({
      data: {
        participationId: participation.id,
        courseOfferingId: roadmap.courseOfferingId,
        roadmapId: roadmap.id,
        roadmapNodeId: nodeId,
      },
      skipDuplicates: true,
    });
    const completion = await tx.simulatedCompletion.findUniqueOrThrow({
      where: {
        participationId_roadmapNodeId: { participationId: participation.id, roadmapNodeId: nodeId },
      },
    });
    return { result: completion, facts: [] };
  },
});

export const resetSimulatedCompletions = roadmapCommand({
  capability: 'edit',
  lock: 'key-share',
  parse: () => null,
  access: 'none',
  run: async ({ tx, roadmap, participation }) => {
    const [completions] = await Promise.all([
      tx.simulatedCompletion.deleteMany({
        where: { participationId: participation.id, roadmapId: roadmap.id },
      }),
      tx.simulatedResourceReview.deleteMany({
        where: {
          participationId: participation.id,
          resource: { roadmapNode: { roadmapId: roadmap.id } },
        },
      }),
    ]);
    return { result: completions, facts: [] };
  },
});
