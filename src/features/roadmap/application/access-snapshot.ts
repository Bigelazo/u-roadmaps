import 'server-only';
import type { Prisma } from '@/shared/server/db';
import { participantNodeAccess, toParticipant } from '@/features/roadmap/domain/participant-view';

export type AccessSnapshot = Readonly<{
  nodes: readonly {
    id: string;
    title: string;
    nodeType: { name: string };
    isVisible: boolean;
    isTeacherBlocked: boolean;
  }[];
  accessibleByUser: ReadonlyMap<string, ReadonlySet<string>>;
  participants: readonly { userId: string; role: 'STUDENT' | 'TEACHER' }[];
}>;

type AccessSnapshotParticipant = Readonly<{
  userId: string;
  role: 'STUDENT' | 'TEACHER';
  isActive: boolean;
}>;

function projectAccessSnapshot({
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
  const completionIdsByUser = new Map<string, Set<string>>();
  for (const completion of completions) {
    const ids = completionIdsByUser.get(completion.userId) ?? new Set<string>();
    ids.add(completion.roadmapNodeId);
    completionIdsByUser.set(completion.userId, ids);
  }

  const accessibleByUser = new Map<string, ReadonlySet<string>>();
  const activeParticipants = participants.filter(({ isActive }) => isActive);
  for (const { userId, role } of activeParticipants) {
    const participant = toParticipant(role, completionIdsByUser.get(userId) ?? new Set());
    accessibleByUser.set(
      userId,
      participantNodeAccess({ participant, nodes, dependencies }).accessibleNodeIds,
    );
  }

  return {
    nodes,
    accessibleByUser,
    participants: activeParticipants.map(({ userId, role }) => ({ userId, role })),
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
