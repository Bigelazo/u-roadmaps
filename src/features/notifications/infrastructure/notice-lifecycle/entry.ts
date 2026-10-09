import 'server-only';
import type { Prisma } from '@/shared/server/db';
import { nodeAccessState } from '@/shared/node-access';
import { dependencyTarget, nodeTypeNameTarget } from '@/shared/route-notice-target';
import { resourceContentState } from '@/shared/server/resource-content-state';
import { ABSENT, PRESENT, availabilityRef, nodeCreationRef } from '../../application/absorption';
import { descriptorForNoticeTarget } from '../../application/notice-targets';
import { resourceValue } from '../../application/notice-targets/resource';
import { pendingTargetSnapshots, type TargetSnapshot } from './recognize';

/**
 * (C) Capture what entering the Roadmap shows the recipient: its pending lifecycle
 * notices, the broad targets it has not recognized (even when their notice never
 * arrived), and the entry state of every target. Values inside a recognized broad
 * target reconcile fully; the rest only rebase pending notices.
 */
export async function entryTargetSnapshots(
  transaction: Prisma.TransactionClient,
  recipientId: string,
  roadmapId: string,
  notices: readonly { id: string; data: Prisma.JsonValue }[],
  accessible: ReadonlySet<string>,
): Promise<Prisma.InputJsonArray> {
  const identity = { recipientId, roadmapId };
  const pending = pendingTargetSnapshots(notices);
  const [nodes, dependencies, types, known] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId },
      include: { nodeType: true, resources: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    }),
    transaction.dependency.findMany({ where: { sourceNode: { roadmapId } } }),
    transaction.nodeType.findMany({ where: { roadmapId } }),
    transaction.noticeKnownValue.findMany({
      where: identity,
      select: { targetKey: true, nodeId: true, knownValue: true },
    }),
  ]);
  const nodeIds = new Set(nodes.map(({ id }) => id));
  const knownKeys = new Set(known.map(({ targetKey }) => targetKey));
  const pendingKeys = new Set(pending.map(({ targetKey }) => targetKey));
  const unknownNodes = new Set(
    known.flatMap(({ targetKey, nodeId, knownValue }) =>
      nodeId && knownValue === ABSENT && targetKey === nodeCreationRef(nodeId).targetKey
        ? [nodeId]
        : [],
    ),
  );
  // An unrecognized creation of a Node that no longer exists has nothing left to tell.
  const vanished = [...unknownNodes].filter((nodeId) => !nodeIds.has(nodeId));
  if (vanished.length)
    await transaction.noticeKnownValue.deleteMany({
      where: {
        ...identity,
        targetKey: { in: vanished.map((nodeId) => nodeCreationRef(nodeId).targetKey) },
      },
    });

  // Broad targets entry shows although their notice is not in the Inbox (e.g. still on its way).
  const availability = availabilityRef(roadmapId);
  const unannounced: TargetSnapshot[] = [];
  if (
    known.some(
      ({ targetKey, knownValue }) => targetKey === availability.targetKey && knownValue === ABSENT,
    ) &&
    !pendingKeys.has(availability.targetKey)
  )
    unannounced.push({
      id: null,
      noticeTarget: 'roadmap-availability',
      ...availability,
      currentValue: PRESENT,
    });
  for (const node of nodes) {
    const creation = nodeCreationRef(node.id);
    if (node.isVisible && unknownNodes.has(node.id) && !pendingKeys.has(creation.targetKey))
      unannounced.push({
        id: null,
        noticeTarget: 'node-creation',
        ...creation,
        currentValue: PRESENT,
        context: { nodeTitle: node.title },
      });
  }
  const broad = [...pending, ...unannounced].filter(
    ({ noticeTarget }) => descriptorForNoticeTarget(noticeTarget)?.scope,
  );
  const roadmapRecognized = broad.some(
    ({ noticeTarget }) => noticeTarget === 'roadmap-availability',
  );
  const recognizedNodes = new Set(
    broad.flatMap(({ noticeTarget, nodeId }) =>
      noticeTarget === 'node-creation' && nodeId ? [nodeId] : [],
    ),
  );

  const state: TargetSnapshot[] = [];
  const value = (snapshot: Omit<TargetSnapshot, 'id' | 'onlyPending'>) =>
    state.push({
      ...snapshot,
      id: null,
      onlyPending: !(
        roadmapRecognized ||
        (snapshot.nodeId && recognizedNodes.has(snapshot.nodeId))
      ),
    });
  for (const node of nodes) {
    // A hidden Node the recipient never knew stays unknown.
    if (!node.isVisible && unknownNodes.has(node.id)) continue;
    const isAccessible = accessible.has(node.id);
    const nodeId = node.id;
    value({
      noticeTarget: 'node-title',
      targetKey: `node:${nodeId}:title`,
      nodeId,
      currentValue: node.title,
    });
    value({
      noticeTarget: 'node-access',
      targetKey: `node:${nodeId}:access`,
      nodeId,
      currentValue: nodeAccessState(node.isVisible, isAccessible),
    });
    value({
      noticeTarget: 'node-type',
      targetKey: `node:${nodeId}:nodeType`,
      nodeId,
      currentValue: node.nodeTypeId,
      context: { typeName: node.nodeType.name, nodeTitle: node.title },
    });
    // A blocked recipient never saw the description, unless it already knew one.
    const description = `node:${nodeId}:description`;
    if (isAccessible || knownKeys.has(description))
      value({
        noticeTarget: 'node-description',
        targetKey: description,
        nodeId,
        currentValue: JSON.stringify(node.description),
        context: { nodeTitle: node.title },
      });
    const current = new Set<string>();
    for (const resource of node.resources) {
      const targetKey = `resource:${resource.id}`;
      current.add(targetKey);
      if (isAccessible || knownKeys.has(targetKey))
        value({
          noticeTarget: 'resource',
          targetKey,
          nodeId,
          currentValue: resourceValue(resourceContentState(resource)),
        });
    }
    for (const { targetKey, nodeId: owner } of known)
      if (owner === nodeId && targetKey.startsWith('resource:') && !current.has(targetKey))
        value({ noticeTarget: 'resource', targetKey, nodeId, currentValue: resourceValue(null) });
  }
  const pairs = new Set(
    dependencies.map(({ sourceNodeId, targetNodeId }) =>
      dependencyTarget(sourceNodeId, targetNodeId),
    ),
  );
  for (const targetKey of pairs)
    value({ noticeTarget: 'dependency', targetKey, nodeId: null, currentValue: 'true' });
  for (const { targetKey } of known)
    if (targetKey.startsWith('dependency:') && !pairs.has(targetKey))
      value({ noticeTarget: 'dependency', targetKey, nodeId: null, currentValue: 'false' });
  for (const type of types)
    value({
      noticeTarget: 'node-type-name',
      targetKey: nodeTypeNameTarget(type.id),
      nodeId: null,
      currentValue: type.name,
    });

  // Broad targets first: their contents are then recognized as known Nodes.
  const narrow = pending.filter((snapshot) => !broad.includes(snapshot));
  return [...broad, ...narrow, ...state] as Prisma.InputJsonArray;
}
