import 'server-only';

import { randomUUID } from 'node:crypto';
import { prisma } from '@/shared/server/db';
import { studentNodeAccessById } from '@/features/roadmap/access';
import type {
  NodeChangeNotice,
  RoadmapClassificationChangeNotice,
  RoadmapAvailabilityNotice,
  RoadmapPathChangeNotice,
  ResourceChangeNotice,
} from './contracts';
import { emitRoadmapAvailability } from './application/emit-roadmap-availability';
import { emitNodeScopedChange } from './application/emit-node-scoped-change';
import { emitRoadmapPathChange } from './application/emit-roadmap-path-change';
import { emitRoadmapClassificationChange } from './application/emit-roadmap-classification-change';
import { novuTransport } from './infrastructure/novu-transport';
import { createSubscriberHash } from './infrastructure/subscriber-hash';

export type InboxIdentity = Readonly<{
  subscriber: string;
  subscriberHash: string;
  applicationIdentifier: string;
  apiUrl?: string;
  socketUrl?: string;
}>;

export function notificationsEnabled() {
  return (
    process.env.NOVU_NOTIFICATIONS_ENABLED === 'true' &&
    (process.env.NODE_ENV !== 'production' || process.env.NOVU_PRODUCTION_APPROVED === 'true')
  );
}

export function getInboxIdentity(userId: string): InboxIdentity | null {
  const applicationIdentifier = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;
  const secretKey = process.env.NOVU_SECRET_KEY;
  if (!notificationsEnabled() || !applicationIdentifier || !secretKey) return null;

  return {
    subscriber: userId,
    subscriberHash: createSubscriberHash(userId, secretKey),
    applicationIdentifier,
    ...(process.env.NEXT_PUBLIC_NOVU_API_URL
      ? { apiUrl: process.env.NEXT_PUBLIC_NOVU_API_URL }
      : {}),
    ...(process.env.NEXT_PUBLIC_NOVU_SOCKET_URL
      ? { socketUrl: process.env.NEXT_PUBLIC_NOVU_SOCKET_URL }
      : {}),
  };
}

type RecipientNode = Readonly<{
  id: string;
  roadmapId: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
}>;

async function eligibleNodeRecipients({
  node,
  courseOfferingId,
  actorId,
}: {
  node: RecipientNode;
  courseOfferingId: string;
  actorId: string;
}) {
  if (!node.isVisible) return [];
  const participants = await prisma.participation.findMany({
    where: { courseOfferingId, isActive: true, userId: { not: actorId } },
    include: { user: { select: { id: true, name: true } } },
  });
  const [visibleNodes, dependencies] = await Promise.all([
    prisma.roadmapNode.findMany({
      where: { roadmapId: node.roadmapId, isVisible: true },
      select: { id: true, isTeacherBlocked: true },
    }),
    prisma.dependency.findMany({
      where: { sourceNode: { roadmapId: node.roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
  ]);
  const visibleNodeIds = new Set(visibleNodes.map(({ id }) => id));
  const visibleDependencies = dependencies.filter(
    ({ sourceNodeId, targetNodeId }) =>
      visibleNodeIds.has(sourceNodeId) && visibleNodeIds.has(targetNodeId),
  );
  const studentParticipants = participants.filter(({ role }) => role === 'STUDENT');
  const completions = studentParticipants.length
    ? await prisma.completion.findMany({
        where: {
          userId: { in: studentParticipants.map(({ userId }) => userId) },
          roadmapNode: { roadmapId: node.roadmapId },
        },
        select: { userId: true, roadmapNodeId: true },
      })
    : [];
  const completionIdsByUser = new Map<string, Set<string>>();
  for (const completion of completions) {
    const completed = completionIdsByUser.get(completion.userId) ?? new Set<string>();
    completed.add(completion.roadmapNodeId);
    completionIdsByUser.set(completion.userId, completed);
  }
  return participants.flatMap((participant) => {
    if (participant.role === 'TEACHER') {
      return !node.isTeacherBlocked
        ? [{ userId: participant.user.id, name: participant.user.name }]
        : [];
    }
    const access = studentNodeAccessById({
      nodes: visibleNodes,
      dependencies: visibleDependencies,
      completedNodeIds: completionIdsByUser.get(participant.userId) ?? new Set(),
    }).get(node.id);
    return access?.status === 'ACCESSIBLE'
      ? [{ userId: participant.user.id, name: participant.user.name }]
      : [];
  });
}

export async function deliverRoadmapAvailability(notice: RoadmapAvailabilityNotice) {
  const workflowId = process.env.NOVU_WORKFLOW_ROADMAP_AVAILABLE;
  if (!notificationsEnabled() || !workflowId) return;

  await emitRoadmapAvailability(
    notice,
    novuTransport,
    async (userIds) => {
      const active = await prisma.participation.findMany({
        where: {
          courseOfferingId: notice.courseOfferingId,
          userId: { in: [...userIds] },
          isActive: true,
        },
        select: { userId: true },
      });
      return active.map(({ userId }) => userId);
    },
    workflowId,
  ).catch(() => {
    // Novu is best-effort: delivery cannot change the committed mutation result.
  });
}

export async function deliverNodeChange(input: {
  userId: string;
  courseCode: string;
  year: number;
  semester: number;
  nodeId: string;
  changeKind: NodeChangeNotice['changeKind'];
  changedFields: NodeChangeNotice['changedFields'];
  nodeTitle?: string;
  nodeTypeName?: string;
  roadmapId?: string;
  recipientIds?: readonly string[];
  targetKind?: 'node' | 'roadmap';
}) {
  if (!notificationsEnabled()) return;
  const workflowId = process.env.NOVU_WORKFLOW_NODE_CHANGE;
  if (!workflowId) return;

  const node = await prisma.roadmapNode.findUnique({
    where: { id: input.nodeId },
    include: {
      nodeType: { select: { name: true } },
      roadmap: {
        include: {
          courseOffering: { include: { course: true } },
        },
      },
    },
  });
  const offering = node?.roadmap.courseOffering;
  if (
    (offering &&
      (offering.courseCode !== input.courseCode ||
        offering.year !== input.year ||
        offering.semester !== input.semester)) ||
    (!node && (!input.recipientIds || !input.nodeTitle))
  )
    return;
  const offeringInfo =
    offering ??
    (await prisma.courseOffering.findUnique({
      where: {
        courseCode_year_semester: {
          courseCode: input.courseCode,
          year: input.year,
          semester: input.semester,
        },
      },
      include: { course: true },
    }));
  if (!offeringInfo) return;
  const roadmapId = input.roadmapId ?? node?.roadmapId;
  if (!roadmapId) return;
  const recipients = input.recipientIds
    ? await prisma.participation
        .findMany({
          where: {
            courseOfferingId: offeringInfo.id,
            isActive: true,
            userId: { in: [...input.recipientIds], not: input.userId },
          },
          include: { user: { select: { id: true, name: true } } },
        })
        .then((participants) =>
          participants.map(({ user }) => ({ userId: user.id, name: user.name })),
        )
    : node?.isVisible
      ? await eligibleNodeRecipients({
          node,
          courseOfferingId: offering!.id,
          actorId: input.userId,
        })
      : [];
  if (!recipients.length) return;

  const notice: NodeChangeNotice = {
    eventId: randomUUID(),
    roadmapId,
    courseOfferingId: offeringInfo.id,
    courseCode: offeringInfo.courseCode,
    year: offeringInfo.year,
    semester: offeringInfo.semester,
    courseName: offeringInfo.course.name,
    nodeId: input.nodeId,
    nodeTitle: input.nodeTitle ?? node!.title,
    changeKind: input.changeKind,
    changedFields: input.changedFields,
    ...(input.nodeTypeName ? { nodeTypeName: input.nodeTypeName } : {}),
    ...(input.targetKind ? { targetKind: input.targetKind } : {}),
    actorId: input.userId,
    actorName:
      (await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }))
        ?.name ?? 'Equipo docente',
    occurredAt: new Date(),
    recipients,
  };

  await emitNodeScopedChange(
    notice,
    novuTransport,
    async (userIds) => {
      const active = await prisma.participation.findMany({
        where: { courseOfferingId: offeringInfo.id, userId: { in: [...userIds] }, isActive: true },
        select: { userId: true },
      });
      return active.map(({ userId }) => userId);
    },
    workflowId,
  ).catch(() => undefined);
}

export async function deliverRoadmapPathChange(input: {
  userId: string;
  identifier: { courseCode: string; year: number; semester: number };
  roadmapId: string;
  changeKind: RoadmapPathChangeNotice['changeKind'];
  dependentNodeTitle: string;
  prerequisiteNodeTitle: string;
  recipientIds: readonly string[];
}) {
  if (!notificationsEnabled()) return;
  const workflowId = process.env.NOVU_WORKFLOW_PATH_CHANGE;
  if (!workflowId || input.recipientIds.length === 0) return;

  const [offering, actor] = await Promise.all([
    prisma.courseOffering.findUnique({
      where: { courseCode_year_semester: input.identifier },
      include: { roadmap: { select: { id: true } } },
    }),
    prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }),
  ]);
  if (!offering || offering.roadmap?.id !== input.roadmapId) return;

  const participants = await prisma.participation.findMany({
    where: {
      courseOfferingId: offering.id,
      isActive: true,
      userId: { in: [...input.recipientIds], not: input.userId },
    },
    include: { user: { select: { id: true, name: true } } },
  });
  const recipients = participants.map(({ user }) => ({ userId: user.id, name: user.name }));
  if (!recipients.length) return;

  const notice: RoadmapPathChangeNotice = {
    eventId: randomUUID(),
    roadmapId: input.roadmapId,
    courseOfferingId: offering.id,
    courseCode: offering.courseCode,
    year: offering.year,
    semester: offering.semester,
    changeKind: input.changeKind,
    dependentNodeTitle: input.dependentNodeTitle,
    prerequisiteNodeTitle: input.prerequisiteNodeTitle,
    actorId: input.userId,
    actorName: actor?.name ?? 'Equipo docente',
    occurredAt: new Date(),
    recipients,
  };

  await emitRoadmapPathChange(
    notice,
    novuTransport,
    async (userIds) => {
      const active = await prisma.participation.findMany({
        where: { courseOfferingId: offering.id, userId: { in: [...userIds] }, isActive: true },
        select: { userId: true },
      });
      return active.map(({ userId }) => userId);
    },
    workflowId,
  ).catch(() => undefined);
}

export async function deliverRoadmapClassificationChange(input: {
  userId: string;
  identifier: { courseCode: string; year: number; semester: number };
  roadmapId: string;
  previousTypeName: string;
  nextTypeName: string;
  recipientIds: readonly string[];
}) {
  try {
    if (!notificationsEnabled()) return;
    const workflowId = process.env.NOVU_WORKFLOW_CLASSIFICATION_CHANGE;
    if (!workflowId || input.recipientIds.length === 0) return;

    const [offering, actor] = await Promise.all([
      prisma.courseOffering.findUnique({
        where: { courseCode_year_semester: input.identifier },
        include: { roadmap: { select: { id: true } } },
      }),
      prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }),
    ]);
    if (!offering || offering.roadmap?.id !== input.roadmapId) return;

    const participants = await prisma.participation.findMany({
      where: {
        courseOfferingId: offering.id,
        isActive: true,
        userId: { in: [...input.recipientIds], not: input.userId },
      },
      include: { user: { select: { id: true, name: true } } },
    });
    const recipients = participants.map(({ user }) => ({ userId: user.id, name: user.name }));
    if (recipients.length === 0) return;

    const notice: RoadmapClassificationChangeNotice = {
      eventId: randomUUID(),
      roadmapId: input.roadmapId,
      courseOfferingId: offering.id,
      courseCode: offering.courseCode,
      year: offering.year,
      semester: offering.semester,
      previousTypeName: input.previousTypeName,
      nextTypeName: input.nextTypeName,
      actorId: input.userId,
      actorName: actor?.name ?? 'Equipo docente',
      occurredAt: new Date(),
      recipients,
    };

    await emitRoadmapClassificationChange(
      notice,
      novuTransport,
      async (userIds) => {
        const active = await prisma.participation.findMany({
          where: {
            courseOfferingId: offering.id,
            userId: { in: [...userIds] },
            isActive: true,
          },
          select: { userId: true },
        });
        return active.map(({ userId }) => userId);
      },
      workflowId,
    );
  } catch {
    // Notification delivery is best-effort and cannot change a committed type rename.
  }
}

export async function deliverResourceChange(input: {
  userId: string;
  identifier: { courseCode: string; year: number; semester: number };
  nodeId: string;
  resourceTitle: string;
  changeKind: ResourceChangeNotice['changeKind'];
}) {
  try {
    if (!notificationsEnabled()) return;
    const workflowId = process.env.NOVU_WORKFLOW_RESOURCE_CHANGE;
    if (!workflowId) return;
    const node = await prisma.roadmapNode.findUnique({
      where: { id: input.nodeId },
      include: { roadmap: { include: { courseOffering: { include: { course: true } } } } },
    });
    if (!node) return;
    const offering = node.roadmap.courseOffering;
    if (
      offering.courseCode !== input.identifier.courseCode ||
      offering.year !== input.identifier.year ||
      offering.semester !== input.identifier.semester
    )
      return;
    const recipients = await eligibleNodeRecipients({
      node,
      courseOfferingId: offering.id,
      actorId: input.userId,
    });
    if (!recipients.length) return;
    const notice: ResourceChangeNotice = {
      eventId: randomUUID(),
      roadmapId: node.roadmapId,
      courseOfferingId: offering.id,
      courseCode: offering.courseCode,
      year: offering.year,
      semester: offering.semester,
      courseName: offering.course.name,
      nodeId: node.id,
      nodeTitle: node.title,
      resourceTitle: input.resourceTitle,
      changeKind: input.changeKind,
      actorId: input.userId,
      actorName:
        (await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }))
          ?.name ?? 'Equipo docente',
      occurredAt: new Date(),
      recipients,
    };
    await emitNodeScopedChange(
      notice,
      novuTransport,
      async (userIds) => {
        const active = await prisma.participation.findMany({
          where: { courseOfferingId: offering.id, userId: { in: [...userIds] }, isActive: true },
          select: { userId: true },
        });
        return active.map(({ userId }) => userId);
      },
      workflowId,
    );
  } catch {
    // Notification delivery is best-effort and cannot change a committed resource mutation.
  }
}
