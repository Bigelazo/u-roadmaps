import 'server-only';
import type { Prisma } from '@/shared/server/db';
import { studentNodeAccessById } from '@/features/roadmap/domain/access';

export type AccessSnapshot = Readonly<{
  nodes: readonly {
    id: string;
    title: string;
    nodeType: { name: string };
    isVisible: boolean;
    isTeacherBlocked: boolean;
  }[];
  accessibleByUser: ReadonlyMap<string, ReadonlySet<string>>;
  participants: readonly { userId: string }[];
}>;

type AccessSnapshotParticipant = Readonly<{
  userId: string;
  role: 'STUDENT' | 'TEACHER';
  isActive: boolean;
}>;

export function projectAccessSnapshot({
  nodes,
  dependencies,
  participants,
  completions,
}: {
  nodes: AccessSnapshot['nodes'];
  dependencies: readonly { sourceNodeId: string; targetNodeId: string }[];
  participants: readonly AccessSnapshotParticipant[];
  completions: readonly { userId: string; roadmapNodeId: string }[];
}): AccessSnapshot {
  const visibleNodes = nodes.filter((node) => node.isVisible);
  const visibleNodeIds = new Set(visibleNodes.map(({ id }) => id));
  const visibleDependencies = dependencies.filter(
    ({ sourceNodeId, targetNodeId }) =>
      visibleNodeIds.has(sourceNodeId) && visibleNodeIds.has(targetNodeId),
  );
  const completionIdsByUser = new Map<string, Set<string>>();
  for (const completion of completions) {
    const ids = completionIdsByUser.get(completion.userId) ?? new Set<string>();
    ids.add(completion.roadmapNodeId);
    completionIdsByUser.set(completion.userId, ids);
  }

  const accessibleByUser = new Map<string, ReadonlySet<string>>();
  const activeParticipants = participants.filter(({ isActive }) => isActive);
  for (const participant of activeParticipants) {
    const accessible =
      participant.role === 'TEACHER'
        ? visibleNodes.filter(({ isTeacherBlocked }) => !isTeacherBlocked).map(({ id }) => id)
        : [
            ...studentNodeAccessById({
              nodes: visibleNodes,
              dependencies: visibleDependencies,
              completedNodeIds: completionIdsByUser.get(participant.userId) ?? new Set(),
            }),
          ]
            .filter(([, access]) => access.status === 'ACCESSIBLE')
            .map(([id]) => id);
    accessibleByUser.set(participant.userId, new Set(accessible));
  }

  return {
    nodes,
    accessibleByUser,
    participants: activeParticipants.map(({ userId }) => ({ userId })),
  };
}

/** Every active participant's Node access, read inside the editing transaction. */
export async function readAccessSnapshot(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  recipientId?: string,
): Promise<AccessSnapshot> {
  const [nodes, dependencies, participants] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId },
      select: {
        id: true,
        title: true,
        isVisible: true,
        isTeacherBlocked: true,
        nodeType: { select: { name: true } },
      },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
    transaction.participation.findMany({
      where: {
        courseOffering: { roadmap: { id: roadmapId } },
        isActive: true,
        ...(recipientId ? { userId: recipientId } : {}),
      },
      select: { userId: true, role: true, isActive: true },
    }),
  ]);
  const studentIds = participants
    .filter(({ role }) => role === 'STUDENT')
    .map(({ userId }) => userId);
  const completions = studentIds.length
    ? await transaction.completion.findMany({
        where: { userId: { in: studentIds }, roadmapNode: { roadmapId } },
        select: { userId: true, roadmapNodeId: true },
      })
    : [];
  return projectAccessSnapshot({ nodes, dependencies, participants, completions });
}
