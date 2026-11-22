import 'server-only';

import type { StudentNodeAccess } from '@/features/roadmap/types';
import { ApplicationError } from '@/shared/errors/server';
import { blockedNodeAccessMessage } from '@/features/roadmap/domain/access';
import {
  unreviewedResourceIds,
  unreviewedResourcesMessage,
} from '@/features/roadmap/domain/resource-review';
import { requireUuid } from '@/shared/validation';
import { nodeNotFound } from './errors';
import {
  roadmapCommand,
  roadmapRead,
  type RoadmapParticipant,
  type RoadmapReadContext,
} from './roadmap-command';
import {
  loadRoadmapProjectionData,
  loadCompletedNodeIds,
  loadReviewedResourceIds,
  loadStudentNodeAccess,
  projectStudentRoadmap,
  projectTeacherRoadmap,
  type RoadmapCompletionScope,
} from '@/features/roadmap/application/completion-projection';

type CompletionKind = RoadmapCompletionScope['kind'];
type CompletionContext = Pick<RoadmapReadContext, 'tx' | 'participation' | 'roadmap'>;

function completionScope(
  kind: CompletionKind,
  { participation, roadmap }: Omit<CompletionContext, 'tx'>,
): RoadmapCompletionScope {
  return kind === 'COMPLETION'
    ? { kind, userId: participation.userId, roadmapId: roadmap.id }
    : { kind, participationId: participation.id, roadmapId: roadmap.id };
}

function blockedNodeAccessError(access: Extract<StudentNodeAccess, { status: 'BLOCKED' }>) {
  return new ApplicationError(403, access.reason, blockedNodeAccessMessage(access));
}

export async function loadCompletedNodeIdsRequiringAccess(
  context: CompletionContext,
  kind: CompletionKind,
  nodeId: string,
) {
  const completedNodeIds = await loadCompletedNodeIds(context.tx, completionScope(kind, context));
  const accessByNodeId = await loadStudentNodeAccess(context.tx, {
    roadmapId: context.roadmap.id,
    completedNodeIds,
  });
  const access = accessByNodeId.get(nodeId);
  if (!access) throw nodeNotFound();
  if (access.status === 'BLOCKED') throw blockedNodeAccessError(access);
  return completedNodeIds;
}

async function requireReviewedResources(
  context: CompletionContext,
  kind: CompletionKind,
  nodeId: string,
) {
  const [resources, reviewedResourceIds] = await Promise.all([
    context.tx.resource.findMany({ where: { roadmapNodeId: nodeId }, select: { id: true } }),
    loadReviewedResourceIds(context.tx, completionScope(kind, context), nodeId),
  ]);
  const pending = unreviewedResourceIds(
    resources.map(({ id }) => id),
    reviewedResourceIds,
  );
  if (pending.length > 0)
    throw new ApplicationError(409, 'UNREVIEWED_RESOURCES', unreviewedResourcesMessage);
}

async function projectStudentProgress(
  kind: CompletionKind,
  { tx, participation, roadmap }: RoadmapReadContext,
  identifier: RoadmapParticipant['identifier'],
) {
  const scope = completionScope(kind, { participation, roadmap });
  const [data, completedNodeIds, reviewedResourceIds] = await Promise.all([
    loadRoadmapProjectionData(tx, { roadmap }),
    loadCompletedNodeIds(tx, scope),
    loadReviewedResourceIds(tx, scope),
  ]);
  return projectStudentRoadmap(data, identifier, { completedNodeIds, reviewedResourceIds });
}

export function readRoadmapForParticipant(participant: RoadmapParticipant) {
  return roadmapRead(participant, 'read', async (context) => {
    if (context.participation.role === 'TEACHER') {
      const data = await loadRoadmapProjectionData(context.tx, { roadmap: context.roadmap });
      return projectTeacherRoadmap(data, participant.identifier);
    }
    return projectStudentProgress('COMPLETION', context, participant.identifier);
  });
}

export function readSimulatedRoadmap(participant: RoadmapParticipant) {
  return roadmapRead(participant, 'oversee', (context) =>
    projectStudentProgress('SIMULATED_COMPLETION', context, participant.identifier),
  );
}

const completionPermissions = {
  COMPLETION: { capability: 'complete', access: 'actor' },
  SIMULATED_COMPLETION: { capability: 'edit', access: 'none' },
} as const;

function completionCommand<Result>(
  kind: CompletionKind,
  record: (context: CompletionContext, nodeId: string) => Promise<Result>,
) {
  return roadmapCommand({
    ...completionPermissions[kind],
    lock: 'key-share',
    parse: ({ nodeId }: { nodeId: string }) => requireUuid(nodeId, 'nodeId'),
    run: async ({ input: nodeId, ...context }) => {
      const completedNodeIds = await loadCompletedNodeIdsRequiringAccess(context, kind, nodeId);
      if (!completedNodeIds.has(nodeId)) await requireReviewedResources(context, kind, nodeId);
      return { result: await record(context, nodeId), facts: [] };
    },
  });
}

export const completeNode = completionCommand(
  'COMPLETION',
  ({ tx, participation: { userId } }, roadmapNodeId) =>
    tx.completion.upsert({
      where: { userId_roadmapNodeId: { userId, roadmapNodeId } },
      update: {},
      create: { userId, roadmapNodeId },
    }),
);

export const completeSimulatedNode = completionCommand(
  'SIMULATED_COMPLETION',
  async ({ tx, participation, roadmap }, roadmapNodeId) => {
    await tx.simulatedCompletion.createMany({
      data: {
        participationId: participation.id,
        courseOfferingId: roadmap.courseOfferingId,
        roadmapId: roadmap.id,
        roadmapNodeId,
      },
      skipDuplicates: true,
    });
    return tx.simulatedCompletion.findUniqueOrThrow({
      where: {
        participationId_roadmapNodeId: { participationId: participation.id, roadmapNodeId },
      },
    });
  },
);

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
