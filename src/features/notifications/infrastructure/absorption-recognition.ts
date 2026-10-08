import 'server-only';
import { resourceContentState } from '@/shared/server/resource-content-state';
import { Prisma } from '@/shared/server/db';
import { recognizeKnownValue, lazyRoadmapEnvelope } from './notice-lifecycle';
import { nodeTitleTarget } from '../application/notice-targets/node-title';
import { resourceTarget, resourceValue } from '../application/notice-targets/resource';
import { recognizeNodeContentValue } from './node-content-notice';
import { dependencyPairTarget } from '../application/notice-targets/dependency-pair';
import { typeNameTarget } from '../application/notice-targets/node-type-name';
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
  resourceIds?: string[];
  recognizesDescription?: boolean;
};
type AbsorptionSnapshot = {
  noticeId: string | null;
  payload: Record<string, unknown>;
  nodes: CapturedNode[];
  routes: CapturedRoute[];
  deletedNodeIds?: string[];
};
/** A route target's value as entry exposed it (older openings carry extra fields). */
type CapturedRoute = {
  routeTarget: 'dependency' | 'type';
  routeTargetKey: string;
  previousValue: string;
};

/** Pairs the recipient has a Known value for, including pairs that no longer exist. */
async function knownDependencyPairs(
  transaction: Prisma.TransactionClient,
  recipientId: string,
  roadmapId: string,
) {
  const known = await transaction.noticeKnownValue.findMany({
    where: { recipientId, roadmapId, targetKey: { startsWith: 'dependency:' } },
    select: { targetKey: true },
  });
  return known.map(({ targetKey }) => targetKey);
}

function capturesRoadmapState(payload: Record<string, unknown>) {
  return payload.changeKind === 'roadmap-available' || payload.snapshotKind === 'roadmap-entry';
}

/** Capture entry state even when a return to known has withdrawn every notice. */
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
  const [roadmap, knownNodes, knownResources, knownDescriptions] = await Promise.all([
    transaction.roadmap.findUniqueOrThrow({
      where: { id: roadmapId },
      include: { courseOffering: true },
    }),
    transaction.nodeLifecycleKnowledge.findMany({
      where: { recipientId, roadmapId, isKnown: true },
    }),
    transaction.noticeKnownValue.findMany({
      where: { recipientId, roadmapId, targetKey: { startsWith: 'resource:' } },
      select: { nodeId: true, targetKey: true },
    }),
    transaction.nodeContentKnowledge.findMany({
      where: { recipientId, target: 'description', node: { roadmapId } },
      select: { nodeId: true },
    }),
  ]);
  const knownResourceIds = new Set(
    knownResources.map(({ targetKey }) => targetKey.slice('resource:'.length)),
  );
  const resourcesByNode = new Map<string, string[]>();
  for (const { nodeId, targetKey } of knownResources) {
    if (!nodeId) continue;
    const resourceId = targetKey.slice('resource:'.length);
    const ids = resourcesByNode.get(nodeId) ?? [];
    ids.push(resourceId);
    resourcesByNode.set(nodeId, ids);
  }
  const descriptionNodeIds = new Set(knownDescriptions.map(({ nodeId }) => nodeId));
  // No notice identity is attached: this records what entry exposed, rather
  // than inventing an availability notice or expanding recognition on retry.
  broad.push({
    id: null,
    data: {
      snapshotKind: 'roadmap-entry',
      eventCount: 1,
      digestKey: `entry:${roadmapId}`,
      roadmapId,
      courseOfferingId: roadmap.courseOfferingId,
      courseCode: roadmap.courseOffering.courseCode,
      year: roadmap.courseOffering.year,
      semester: roadmap.courseOffering.semester,
      actorName: 'Equipo docente',
      occurredAt: new Date().toISOString(),
      targetKind: 'roadmap',
    },
  });
  const nodes = await transaction.roadmapNode.findMany({
    where: {
      roadmapId,
      // A missing lifecycle row means an existing known Node. Only explicit
      // unknown creations must remain unknown while hidden.
      OR: [{ isVisible: true }, { id: { notIn: unknown.map(({ nodeId }) => nodeId) } }],
    },
    include: { nodeType: true, resources: true },
  });
  const currentNodeIds = new Set(nodes.map(({ id }) => id));
  const deletedNodeIds = knownNodes
    .map(({ nodeId }) => nodeId)
    .filter((nodeId) => !currentNodeIds.has(nodeId));
  const routes: CapturedRoute[] = [];
  if (broad.some(({ data }) => capturesRoadmapState(data as Prisma.JsonObject))) {
    const [dependencies, types, knownPairs] = await Promise.all([
      transaction.dependency.findMany({ where: { sourceNode: { roadmapId } } }),
      transaction.nodeType.findMany({ where: { roadmapId } }),
      knownDependencyPairs(transaction, recipientId, roadmapId),
    ]);
    const pairs = new Map(
      dependencies.map((dependency) => [
        dependencyTarget(dependency.sourceNodeId, dependency.targetNodeId),
        true,
      ]),
    );
    for (const key of knownPairs) if (!pairs.has(key)) pairs.set(key, false);
    for (const [key, exists] of pairs)
      routes.push({
        routeTarget: 'dependency',
        routeTargetKey: key,
        previousValue: String(exists),
      });
    for (const type of types)
      routes.push({
        routeTarget: 'type',
        routeTargetKey: nodeTypeNameTarget(type.id),
        previousValue: type.name,
      });
  }
  return broad.map(({ id, data }) => {
    const payload = data as Prisma.JsonObject;
    return {
      noticeId: id,
      payload,
      deletedNodeIds: payload.snapshotKind === 'roadmap-entry' ? deletedNodeIds : [],
      routes: capturesRoadmapState(payload) ? routes : [],
      nodes: nodes
        .filter((node) => capturesRoadmapState(payload) || node.id === payload.nodeId)
        .map((node) => ({
          id: node.id,
          title: node.title,
          description: node.description,
          nodeTypeId: node.nodeTypeId,
          nodeTypeName: node.nodeType.name,
          access: !node.isVisible
            ? 'Retirado'
            : accessible.has(node.id)
              ? 'Disponible'
              : 'Bloqueado',
          resourceIds: resourcesByNode.get(node.id) ?? [],
          recognizesDescription: accessible.has(node.id) || descriptionNodeIds.has(node.id),
          resources: node.resources
            .filter((resource) => accessible.has(node.id) || knownResourceIds.has(resource.id))
            .map((resource) => ({ id: resource.id, ...resourceContentState(resource) })),
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
  const envelope = lazyRoadmapEnvelope(transaction, identity.roadmapId);
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
    const reconcileOnlyPending = snapshot.payload.snapshotKind === 'roadmap-entry';
    // Internal snapshot markers must never leak into stored Notice payloads,
    // where they could make a later Node notice masquerade as a broad entry.
    const deliveryPayload = { ...snapshot.payload };
    delete deliveryPayload.snapshotKind;
    if (snapshot.deletedNodeIds?.length) {
      await transaction.nodeLifecycleKnowledge.updateMany({
        where: {
          recipientId: identity.recipientId,
          roadmapId: identity.roadmapId,
          nodeId: { in: snapshot.deletedNodeIds },
          isKnown: true,
        },
        data: { isKnown: false },
      });
      await transaction.roadmapNotice.deleteMany({
        where: {
          recipientId: identity.recipientId,
          roadmapId: identity.roadmapId,
          acknowledgedAt: null,
          OR: snapshot.deletedNodeIds.map((nodeId) => ({
            data: { path: ['nodeId'], equals: nodeId },
          })),
        },
      });
    }
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
      const lifecycleKnowledge = await transaction.nodeLifecycleKnowledge.findUnique({
        where: { recipientId_roadmapId_nodeId: lifecycle },
      });
      if (!lifecycleKnowledge?.isKnown) {
        await transaction.nodeLifecycleKnowledge.upsert({
          where: { recipientId_roadmapId_nodeId: lifecycle },
          create: { ...lifecycle, isKnown: true },
          update: { isKnown: true },
        });
      }
      const effect = {
        eventId: `recognition:${identity.operationId}:${node.id}`,
        recipientId: identity.recipientId,
        roadmapId: identity.roadmapId,
        courseOfferingId: String(snapshot.payload.courseOfferingId),
        noticeClass: 'roadmap-node-changed' as const,
      };
      const payload = {
        ...deliveryPayload,
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
        // An ordinary entry must not manufacture a notice for the recipient's
        // own deletion, which deliberately has no delivery to that actor.
        if (
          reconcileOnlyPending &&
          !(await transaction.roadmapNotice.findFirst({
            where: {
              recipientId: identity.recipientId,
              roadmapId: identity.roadmapId,
              acknowledgedAt: null,
              AND: [
                { data: { path: ['nodeId'], equals: node.id } },
                { data: { path: ['changeKind'], equals: 'node-deleted' } },
              ],
            },
            select: { id: true },
          }))
        )
          continue;
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
      await recognizeKnownValue(transaction, {
        identity: { recipientId: identity.recipientId, roadmapId: identity.roadmapId },
        descriptor: nodeTitleTarget,
        target: { targetKey: `node:${node.id}:title`, nodeId: node.id },
        knownValue: node.title,
        eventId: `${effect.eventId}:title`,
        envelope,
        onlyPending: reconcileOnlyPending,
      });
      for (const target of [
        'access',
        'nodeType',
        ...(node.access === 'Disponible' || node.recognizesDescription ? ['description'] : []),
      ] as const) {
        const contentTarget = target as 'access' | 'nodeType' | 'description';
        const knownValue =
          target === 'access'
            ? node.access
            : target === 'nodeType'
              ? node.nodeTypeId
              : JSON.stringify(node.description);
        await recognizeNodeContentValue(
          transaction,
          {
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
          },
          knownValue,
          target === 'nodeType' ? node.nodeTypeName : undefined,
          reconcileOnlyPending,
        );
      }
      const knownResources = new Map(node.resources.map((resource) => [resource.id, resource]));
      const resourceIds = new Set([
        ...(node.resourceIds ?? []),
        ...knownResources.keys(),
        ...(node.access === 'Disponible' ? current.resources.map(({ id }) => id) : []),
      ]);
      for (const resourceId of resourceIds) {
        const resource = knownResources.get(resourceId);
        await recognizeKnownValue(transaction, {
          identity: { recipientId: identity.recipientId, roadmapId: identity.roadmapId },
          descriptor: resourceTarget,
          target: { targetKey: `resource:${resourceId}`, nodeId: node.id },
          knownValue: resourceValue(resource ?? null),
          eventId: `${effect.eventId}:${resourceId}`,
          envelope,
          onlyPending: reconcileOnlyPending,
        });
      }
    }
    const routes = [...snapshot.routes];
    if (capturesRoadmapState(snapshot.payload)) {
      // A pair absent on entry is known to be absent, even if its first-ever
      // insertion was absorbed before acknowledgement.
      const [dependencies, knownPairs] = await Promise.all([
        transaction.dependency.findMany({
          where: { sourceNode: { roadmapId: identity.roadmapId } },
        }),
        knownDependencyPairs(transaction, identity.recipientId, identity.roadmapId),
      ]);
      const pairs = new Set([
        ...dependencies.map(({ sourceNodeId, targetNodeId }) =>
          dependencyTarget(sourceNodeId, targetNodeId),
        ),
        ...knownPairs,
      ]);
      for (const key of pairs)
        if (!routes.some(({ routeTargetKey }) => routeTargetKey === key))
          routes.push({ routeTarget: 'dependency', routeTargetKey: key, previousValue: 'false' });
    }
    for (const route of routes)
      await recognizeKnownValue(transaction, {
        identity: { recipientId: identity.recipientId, roadmapId: identity.roadmapId },
        descriptor: route.routeTarget === 'dependency' ? dependencyPairTarget : typeNameTarget,
        target: { targetKey: route.routeTargetKey, nodeId: null },
        knownValue: route.previousValue,
        eventId: `recognition:${identity.operationId}:${route.routeTargetKey}`,
        envelope,
        onlyPending: reconcileOnlyPending,
      });
    if (capturesRoadmapState(snapshot.payload)) {
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
            ...deliveryPayload,
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
