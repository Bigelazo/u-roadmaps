import 'server-only';

import type { Prisma } from '@/shared/server/db';
import type { StudentNodeAccess } from '@/features/roadmap/types';
import { ApplicationError } from '@/shared/errors/server';
import { blockedNodeAccessMessage } from '@/features/roadmap/domain/access';
import { roadmapCommand, roadmapRead, type RoadmapParticipant } from './roadmap-command';
import {
  loadRoadmapProjectionData,
  loadCompletedNodeIds,
  loadStudentNodeAccess,
  projectStudentRoadmap,
  projectTeacherRoadmap,
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

export function readRoadmapForParticipant(participant: RoadmapParticipant) {
  return roadmapRead(
    participant,
    'read',
    async ({ tx, courseOffering, participation, roadmap }) => {
      if (participation.role === 'TEACHER') {
        const data = await loadRoadmapProjectionData(tx, { courseOffering, roadmap });
        return projectTeacherRoadmap(data, participant.identifier);
      }
      const [data, completedNodeIds] = await Promise.all([
        loadRoadmapProjectionData(tx, { courseOffering, roadmap }),
        loadCompletedNodeIds(tx, {
          kind: 'COMPLETION',
          userId: participant.userId,
          roadmapId: roadmap.id,
        }),
      ]);
      return projectStudentRoadmap(data, participant.identifier, completedNodeIds);
    },
  );
}

/** A student's Completion; it can change Node access only for that student. */
export const completeNode = roadmapCommand({
  capability: 'complete',
  lock: 'key-share',
  parse: ({ nodeId }: { nodeId: string }) => nodeId,
  access: 'actor',
  run: async ({ tx, roadmap, actor, input: nodeId }) => {
    await requireStudentNodeAccess(tx, { userId: actor.userId, roadmapId: roadmap.id, nodeId });
    const completion = await tx.completion.upsert({
      where: { userId_roadmapNodeId: { userId: actor.userId, roadmapNodeId: nodeId } },
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
      const [data, completedNodeIds] = await Promise.all([
        loadRoadmapProjectionData(tx, { courseOffering, roadmap }),
        loadCompletedNodeIds(tx, {
          kind: 'SIMULATED_COMPLETION',
          participationId: participation.id,
          roadmapId: roadmap.id,
        }),
      ]);
      return projectStudentRoadmap(data, participant.identifier, completedNodeIds);
    },
  );
}

/** Canvas preview progress: the teacher's own simulated Completion, which notifies nobody. */
export const completeSimulatedNode = roadmapCommand({
  capability: 'edit',
  lock: 'key-share',
  parse: ({ nodeId }: { nodeId: string }) => nodeId,
  access: 'none',
  run: async ({ tx, roadmap, participation, input: nodeId }) => {
    const completedNodeIds = await loadCompletedNodeIds(tx, {
      kind: 'SIMULATED_COMPLETION',
      participationId: participation.id,
      roadmapId: roadmap.id,
    });
    await requireNodeAccess(tx, { roadmapId: roadmap.id, nodeId, completedNodeIds });
    // ON CONFLICT DO NOTHING, not an upsert: when a concurrent request inserts the same
    // simulated Completion first, an upsert fails with a unique violation (P2002, a 409),
    // while this raises a serialization failure that the change transaction retries.
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

/** Clears the teacher's Canvas preview progress. */
export const resetSimulatedCompletions = roadmapCommand({
  capability: 'edit',
  lock: 'key-share',
  parse: () => null,
  access: 'none',
  run: async ({ tx, roadmap, participation }) => ({
    result: await tx.simulatedCompletion.deleteMany({
      where: { participationId: participation.id, roadmapId: roadmap.id },
    }),
    facts: [],
  }),
});
