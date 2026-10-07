import 'server-only';
import { Prisma } from '@/shared/server/db';
import { reconcileStoredTitle } from './title-notice';
import { reconcileStoredNodeContent } from './node-content-notice';
import { reconcileStoredResource } from './resource-notice';
import { reconcileStoredRoute } from './route-notice';
import type { RoutePayload } from '../application/route-effect';
import { dependencyTarget, nodeTypeNameTarget } from '@/shared/route-notice-target';
import { reconcileStoredAbsorption } from './absorption-notice';
import { projectDigestNotification } from '../digest-projection';
import { NODE_ACCESS_STATES, type NodeAccessState } from '@/shared/node-access';

type CapturedNode = {
  id: string;
  title: string;
  description: string | null;
  nodeTypeId: string;
  nodeTypeName: string;
  access: NodeAccessState;
  resources: { id: string; title: string; revision: string }[];
};
type AbsorptionSnapshot = {
  noticeId: string | null;
  payload: Record<string, unknown>;
  nodes: CapturedNode[];
  routes: RoutePayload[];
};

/** Capture the values actually exposed on entry, including absorbed targets. */
export async function absorptionOpeningSnapshots(
  transaction: Prisma.TransactionClient,
  recipientId: string,
  roadmapId: string,
  notices: readonly { id: string; data: Prisma.JsonValue }[],
  accessible: ReadonlySet<string>,
) {
  const broad: { id: string | null; data: Prisma.JsonValue }[] = notices.filter(
    ({ data }) =>
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      (data.changeKind === 'roadmap-available' || data.noticeTarget === 'node-creation'),
  );
  // Entry can race deferred delivery. The Node already exists in the recipient's
  // Roadmap even when its creation has not reached the Inbox yet.
  const unknown = await transaction.nodeLifecycleKnowledge.findMany({
    where: { recipientId, roadmapId, isKnown: false },
  });
  const hasAvailability = broad.some(
    ({ data }) => (data as Prisma.JsonObject).changeKind === 'roadmap-available',
  );
  const missing = hasAvailability
    ? []
    : unknown.filter(
        ({ nodeId }) => !broad.some(({ data }) => (data as Prisma.JsonObject).nodeId === nodeId),
      );
  if (missing.length) {
    const roadmap = await transaction.roadmap.findUniqueOrThrow({
      where: { id: roadmapId },
      include: { courseOffering: { include: { course: true } } },
    });
    for (const { nodeId } of missing)
      broad.push({
        id: null,
        data: {
          roadmapId,
          nodeId,
          courseOfferingId: roadmap.courseOfferingId,
          courseCode: roadmap.courseOffering.courseCode,
          year: roadmap.courseOffering.year,
          semester: roadmap.courseOffering.semester,
          actorName: 'Equipo docente',
          changeKind: 'node-available',
          noticeTarget: 'node-creation',
          targetKind: 'node',
          eventCount: 1,
          digestKey: `entry:${nodeId}`,
          occurredAt: new Date().toISOString(),
        },
      });
  }
  if (!broad.length) return [] as Prisma.InputJsonArray;
  const nodes = await transaction.roadmapNode.findMany({
    where: { roadmapId, isVisible: true },
    include: { nodeType: true, resources: true },
  });
  const routes: RoutePayload[] = [];
  if (broad.some(({ data }) => (data as Prisma.JsonObject).changeKind === 'roadmap-available')) {
    const [dependencies, types, knowledge] = await Promise.all([
      transaction.dependency.findMany({ where: { sourceNode: { roadmapId } } }),
      transaction.nodeType.findMany({ where: { roadmapId } }),
      transaction.routeNoticeKnowledge.findMany({
        where: { recipientId, roadmapId, targetKey: { startsWith: 'dependency:' } },
      }),
    ]);
    const pairs = new Map(
      dependencies.map((dependency) => [
        dependencyTarget(dependency.sourceNodeId, dependency.targetNodeId),
        true,
      ]),
    );
    for (const item of knowledge) if (!pairs.has(item.targetKey)) pairs.set(item.targetKey, false);
    for (const [key, exists] of pairs) {
      const [, sourceNodeId, targetNodeId] = key.split(':');
      routes.push({
        routeTarget: 'dependency',
        routeTargetKey: key,
        sourceNodeId,
        targetNodeId,
        previousValue: String(exists),
        occurredAt: new Date().toISOString(),
      });
    }
    for (const type of types)
      routes.push({
        routeTarget: 'type',
        routeTargetKey: nodeTypeNameTarget(type.id),
        nodeTypeId: type.id,
        previousValue: type.name,
        previousTypeName: type.name,
        occurredAt: new Date().toISOString(),
      });
  }
  return broad.map(({ id, data }) => {
    const payload = data as Prisma.JsonObject;
    return {
      noticeId: id,
      payload,
      routes: payload.changeKind === 'roadmap-available' ? routes : [],
      nodes: nodes
        .filter((node) => payload.changeKind === 'roadmap-available' || node.id === payload.nodeId)
        .map((node) => ({
          id: node.id,
          title: node.title,
          description: node.description,
          nodeTypeId: node.nodeTypeId,
          nodeTypeName: node.nodeType.name,
          access: accessible.has(node.id) ? 'Disponible' : 'Bloqueado',
          resources: accessible.has(node.id)
            ? node.resources.map((resource) => ({
                id: resource.id,
                title: resource.title,
                revision: resource.updatedAt.toISOString(),
              }))
            : [],
        })),
    };
  }) as Prisma.InputJsonArray;
}

/** Rebase independent targets on the broad notice's captured current state. */
export async function recognizeAbsorptionSnapshots(
  transaction: Prisma.TransactionClient,
  identity: {
    recipientId: string;
    roadmapId: string;
    operationId: string;
    snapshots: Prisma.JsonValue;
  },
) {
  if (!Array.isArray(identity.snapshots)) throw new Error('Invalid absorption snapshots.');
  let acknowledged = 0;
  for (const value of identity.snapshots) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !Array.isArray(value.nodes) ||
      !value.payload ||
      !Array.isArray(value.routes) ||
      value.nodes.some(
        (node) =>
          !node ||
          typeof node !== 'object' ||
          Array.isArray(node) ||
          typeof node.access !== 'string' ||
          !NODE_ACCESS_STATES.includes(node.access as NodeAccessState),
      )
    )
      throw new Error('Invalid absorption snapshot.');
    const snapshot = value as unknown as AbsorptionSnapshot;
    if (snapshot.noticeId) {
      acknowledged += (
        await transaction.roadmapNotice.updateMany({
          where: {
            id: snapshot.noticeId,
            recipientId: identity.recipientId,
            roadmapId: identity.roadmapId,
            acknowledgedAt: null,
          },
          data: { acknowledgedAt: new Date() },
        })
      ).count;
    }
    for (const node of snapshot.nodes) {
      const lifecycle = {
        recipientId: identity.recipientId,
        roadmapId: identity.roadmapId,
        nodeId: node.id,
      };
      await transaction.nodeLifecycleKnowledge.upsert({
        where: { recipientId_roadmapId_nodeId: lifecycle },
        create: { ...lifecycle, isKnown: true },
        update: { isKnown: true },
      });
      const effect = {
        eventId: `recognition:${identity.operationId}:${node.id}`,
        recipientId: identity.recipientId,
        roadmapId: identity.roadmapId,
        courseOfferingId: String(snapshot.payload.courseOfferingId),
        noticeClass: 'roadmap-node-changed' as const,
      };
      const payload = {
        ...snapshot.payload,
        nodeId: node.id,
        nodeTitle: node.title,
        changeKind: 'node-updated',
        occurredAt: new Date().toISOString(),
        targetKind: 'node',
      };
      const current = await transaction.roadmapNode.findUnique({
        where: { id: node.id },
        include: { resources: true, nodeType: true },
      });
      if (!current) {
        const deletionPayload = {
          ...payload,
          nodeTypeName: node.nodeTypeName,
          changeKind: 'node-deleted',
          targetKind: 'roadmap',
          noticeTitle: node.title,
          noticeBody: `Nodo eliminado: «${node.title}».`,
        };
        await reconcileStoredAbsorption(transaction, { ...effect, payload: deletionPayload });
        const projection = projectDigestNotification(deletionPayload, []);
        await transaction.roadmapNotice.createMany({
          data: [
            {
              eventId: `${effect.eventId}:deletion`,
              recipientId: identity.recipientId,
              roadmapId: identity.roadmapId,
              courseOfferingId: effect.courseOfferingId,
              occurredAt: new Date(payload.occurredAt),
              ...projection,
              data: {
                ...deletionPayload,
                ...projection.data,
                noticeClass: effect.noticeClass,
              } as Prisma.InputJsonObject,
            },
          ],
          skipDuplicates: true,
        });
        continue;
      }
      await transaction.nodeTitleKnowledge.upsert({
        where: { recipientId_nodeId: { recipientId: identity.recipientId, nodeId: node.id } },
        create: { recipientId: identity.recipientId, nodeId: node.id, knownTitle: node.title },
        update: { knownTitle: node.title },
      });
      await reconcileStoredTitle(transaction, {
        ...effect,
        payload: { ...payload, previousTitle: node.title },
      });
      for (const target of [
        'access',
        'nodeType',
        ...(node.access === 'Disponible' ? ['description'] : []),
      ] as const) {
        const contentTarget = target as 'access' | 'nodeType' | 'description';
        const knownValue =
          target === 'access'
            ? node.access
            : target === 'nodeType'
              ? node.nodeTypeId
              : JSON.stringify(node.description);
        const knowledge = { recipientId: identity.recipientId, nodeId: node.id, target };
        const baseline = {
          knownValue,
          ...(target === 'nodeType' ? { knownTypeName: node.nodeTypeName } : {}),
        };
        await transaction.nodeContentKnowledge.upsert({
          where: { recipientId_nodeId_target: knowledge },
          create: {
            ...knowledge,
            ...baseline,
            ...(target === 'access'
              ? {
                  currentValue: current.isVisible
                    ? current.isTeacherBlocked
                      ? 'Bloqueado'
                      : node.access
                    : 'Retirado',
                }
              : {}),
          },
          update: baseline,
        });
        await reconcileStoredNodeContent(transaction, {
          ...effect,
          eventId: `${effect.eventId}:${target}`,
          payload: {
            ...payload,
            contentTarget,
            previousValue: knownValue,
            ...(target === 'nodeType'
              ? { previousTypeName: node.nodeTypeName, currentTypeName: current.nodeType.name }
              : {}),
          },
        });
      }
      if (node.access !== 'Disponible') continue;
      const resources = new Map(node.resources.map((resource) => [resource.id, resource]));
      for (const resource of current.resources)
        if (!resources.has(resource.id))
          resources.set(resource.id, { id: resource.id, title: resource.title, revision: '' });
      for (const resource of resources.values()) {
        const known = resource.revision
          ? { title: resource.title, revision: resource.revision }
          : null;
        const resourceIdentity = { recipientId: identity.recipientId, resourceId: resource.id };
        const knownState = known ? JSON.stringify(known) : null;
        await transaction.resourceNoticeKnowledge.upsert({
          where: { recipientId_resourceId: resourceIdentity },
          create: { ...resourceIdentity, nodeId: node.id, knownState },
          update: { knownState },
        });
        await reconcileStoredResource(transaction, {
          ...effect,
          eventId: `${effect.eventId}:${resource.id}`,
          noticeClass: 'roadmap-resource-changed',
          payload: {
            ...payload,
            resourceId: resource.id,
            previousResource: known,
          },
        });
      }
    }
    const routes = [...snapshot.routes];
    if (snapshot.payload.changeKind === 'roadmap-available') {
      // A pair absent on entry is known to be absent, even if its first-ever
      // insertion was absorbed before acknowledgement.
      const [dependencies, knowledge] = await Promise.all([
        transaction.dependency.findMany({
          where: { sourceNode: { roadmapId: identity.roadmapId } },
        }),
        transaction.routeNoticeKnowledge.findMany({
          where: {
            recipientId: identity.recipientId,
            roadmapId: identity.roadmapId,
            targetKey: { startsWith: 'dependency:' },
          },
        }),
      ]);
      const pairs = new Set([
        ...dependencies.map(({ sourceNodeId, targetNodeId }) =>
          dependencyTarget(sourceNodeId, targetNodeId),
        ),
        ...knowledge.map(({ targetKey }) => targetKey),
      ]);
      for (const key of pairs)
        if (!routes.some(({ routeTargetKey }) => routeTargetKey === key)) {
          const [, sourceNodeId, targetNodeId] = key.split(':');
          routes.push({
            routeTarget: 'dependency',
            routeTargetKey: key,
            sourceNodeId,
            targetNodeId,
            previousValue: 'false',
            occurredAt: new Date().toISOString(),
          });
        }
    }
    for (const route of routes) {
      const routeIdentity = {
        recipientId: identity.recipientId,
        roadmapId: identity.roadmapId,
        targetKey: route.routeTargetKey,
      };
      await transaction.routeNoticeKnowledge.upsert({
        where: { recipientId_roadmapId_targetKey: routeIdentity },
        create: { ...routeIdentity, knownValue: route.previousValue },
        update: { knownValue: route.previousValue },
      });
      await reconcileStoredRoute(transaction, {
        eventId: `recognition:${identity.operationId}:${route.routeTargetKey}`,
        recipientId: identity.recipientId,
        roadmapId: identity.roadmapId,
        courseOfferingId: String(snapshot.payload.courseOfferingId),
        noticeClass:
          route.routeTarget === 'dependency'
            ? 'roadmap-path-changed'
            : 'roadmap-classification-changed',
        payload: {
          ...snapshot.payload,
          ...route,
          changeKind:
            route.routeTarget === 'dependency'
              ? route.previousValue === 'true'
                ? 'dependency-added'
                : 'dependency-removed'
              : 'classification-updated',
        },
      });
    }
    if (snapshot.payload.changeKind === 'roadmap-available') {
      const unrecognized = await transaction.nodeLifecycleKnowledge.findMany({
        where: {
          recipientId: identity.recipientId,
          roadmapId: identity.roadmapId,
          isKnown: false,
        },
      });
      for (const knowledge of unrecognized) {
        const nodeId = knowledge.nodeId;
        await reconcileStoredAbsorption(transaction, {
          eventId: `recognition:${identity.operationId}:${nodeId}:creation`,
          recipientId: identity.recipientId,
          roadmapId: identity.roadmapId,
          courseOfferingId: String(snapshot.payload.courseOfferingId),
          noticeClass: 'roadmap-node-changed',
          payload: {
            ...snapshot.payload,
            nodeId,
            changeKind: 'node-available',
            occurredAt: new Date().toISOString(),
          },
        });
      }
    }
  }
  return acknowledged;
}
