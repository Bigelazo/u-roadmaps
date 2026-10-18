import 'server-only';
import type { Prisma } from '@/shared/server/db';
import { resourceContentState } from '@/shared/server/resource-content-state';
import { ApplicationError } from '@/shared/errors/server';
import type {
  ParticipantAccess,
  ParticipantRole,
  RoadmapView,
  RoadmapViewDependency,
  RoadmapViewNode,
  RoadmapViewNodeType,
  RoadmapViewResource,
} from '../../application/notice-targets';

/** One participant's accessible Nodes per Roadmap; a Roadmap without their active Participation is absent. */
export type ParticipantAccessReader = (
  transaction: Prisma.TransactionClient,
  query: { userId: string; roadmapIds: readonly string[] },
) => Promise<ReadonlyMap<string, ReadonlySet<string>>>;

/** Every active participant of one Roadmap, with their role, and each one's accessible Nodes. */
export type RoadmapAccessReader = (
  transaction: Prisma.TransactionClient,
  roadmapId: string,
) => Promise<
  Readonly<{
    participants: readonly { userId: string; role: ParticipantAccess['role'] }[];
    accessibleByUser: ReadonlyMap<string, ReadonlySet<string>>;
  }>
>;

/** Access found only for an active Participation; without one it is 403. */
function participationRequired(accessible: ReadonlySet<string> | undefined) {
  if (!accessible) throw new ApplicationError(403, 'FORBIDDEN', 'No tienes acceso a este Roadmap.');
  return accessible;
}

/** One Roadmap's accessible Nodes; without an active Participation it is 403. */
export async function roadmapNodeAccess(
  readAccess: ParticipantAccessReader,
  transaction: Prisma.TransactionClient,
  userId: string,
  roadmapId: string,
): Promise<ReadonlySet<string>> {
  const access = await readAccess(transaction, { userId, roadmapIds: [roadmapId] });
  return participationRequired(access.get(roadmapId));
}

const nodeSelect = {
  id: true,
  title: true,
  description: true,
  isVisible: true,
  isTeacherBlocked: true,
  nodeTypeId: true,
  nodeType: { select: { name: true } },
} as const;

function viewNode({
  nodeType,
  ...node
}: Prisma.RoadmapNodeGetPayload<{ select: typeof nodeSelect }>): RoadmapViewNode {
  return { ...node, nodeTypeName: nodeType.name };
}

function viewResource(
  row: Parameters<typeof resourceContentState>[0] & {
    id: string;
    roadmapNodeId: string;
  },
): RoadmapViewResource {
  return { id: row.id, nodeId: row.roadmapNodeId, ...resourceContentState(row) };
}

const resourceOrder = [{ createdAt: 'asc' }, { id: 'asc' }] as const;

/**
 * A memoized view of one Roadmap inside a transaction (it sees the transaction's own
 * writes up to each first read). Single lookups query on demand; once a whole collection
 * is loaded (`nodes`, `resources`, ..., `participantAccess` or `preload`), lookups answer
 * from it. Node access needs its readers: `readAccess` for one participant,
 * `readRoadmapAccess` for every participant at once.
 */
export function roadmapView(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  readAccess?: ParticipantAccessReader,
  readRoadmapAccess?: RoadmapAccessReader,
): RoadmapView {
  let participants: ReturnType<RoadmapView['participants']> | undefined;
  let allNodes: Promise<readonly RoadmapViewNode[]> | undefined;
  let allResources: Promise<readonly RoadmapViewResource[]> | undefined;
  let allDependencies: Promise<readonly RoadmapViewDependency[]> | undefined;
  let allNodeTypes: Promise<readonly RoadmapViewNodeType[]> | undefined;
  const nodes = new Map<string, Promise<RoadmapViewNode | null>>();
  const resources = new Map<string, Promise<RoadmapViewResource | null>>();
  const roles = new Map<string, Promise<ParticipantRole | null>>();
  const accessible = new Map<string, Promise<ReadonlySet<string>>>();
  let allAccess: Promise<ReadonlyMap<string, ParticipantAccess>> | undefined;
  const nodeTypes = new Map<string, Promise<RoadmapViewNodeType | null>>();
  const nodeResources = new Map<string, ReturnType<RoadmapView['nodeResources']>>();
  let course: ReturnType<RoadmapView['course']> | undefined;
  const view: RoadmapView = {
    roadmapId,
    participants() {
      participants ??= transaction.participation.findMany({
        where: { courseOffering: { roadmap: { id: roadmapId } }, isActive: true },
        select: { userId: true, role: true },
        orderBy: { userId: 'asc' },
      });
      return participants;
    },
    role(userId) {
      if (participants)
        return participants.then((all) => all.find((one) => one.userId === userId)?.role ?? null);
      let role = roles.get(userId);
      if (!role) {
        role = transaction.participation
          .findFirst({
            where: { userId, courseOffering: { roadmap: { id: roadmapId } }, isActive: true },
            select: { role: true },
          })
          .then((found) => found?.role ?? null);
        roles.set(userId, role);
      }
      return role;
    },
    nodes() {
      allNodes ??= transaction.roadmapNode
        .findMany({ where: { roadmapId }, select: nodeSelect, orderBy: { id: 'asc' } })
        .then((rows) => rows.map(viewNode));
      return allNodes;
    },
    node(nodeId) {
      if (allNodes) return allNodes.then((all) => all.find(({ id }) => id === nodeId) ?? null);
      let node = nodes.get(nodeId);
      if (!node) {
        node = transaction.roadmapNode
          .findFirst({ where: { id: nodeId, roadmapId }, select: nodeSelect })
          .then((found) => (found ? viewNode(found) : null));
        nodes.set(nodeId, node);
      }
      return node;
    },
    resources() {
      allResources ??= transaction.resource
        .findMany({ where: { roadmapNode: { roadmapId } }, orderBy: [...resourceOrder] })
        .then((rows) => rows.map(viewResource));
      return allResources;
    },
    resource(resourceId) {
      if (allResources)
        return allResources.then((all) => all.find(({ id }) => id === resourceId) ?? null);
      let resource = resources.get(resourceId);
      if (!resource) {
        resource = transaction.resource
          .findFirst({ where: { id: resourceId, roadmapNode: { roadmapId } } })
          .then((row) => (row ? viewResource(row) : null));
        resources.set(resourceId, resource);
      }
      return resource;
    },
    nodeResources(nodeId) {
      if (allResources)
        return allResources.then((all) => all.filter((resource) => resource.nodeId === nodeId));
      let found = nodeResources.get(nodeId);
      if (!found) {
        found = transaction.resource
          .findMany({
            where: { roadmapNodeId: nodeId, roadmapNode: { roadmapId } },
            orderBy: [...resourceOrder],
          })
          .then((rows) => rows.map(viewResource));
        nodeResources.set(nodeId, found);
      }
      return found;
    },
    course() {
      course ??= transaction.roadmap
        .findUnique({
          where: { id: roadmapId },
          select: { courseOffering: { select: { courseCode: true } } },
        })
        .then((roadmap) => (roadmap ? { courseCode: roadmap.courseOffering.courseCode } : null));
      return course;
    },
    accessibleNodeIds(userId) {
      if (allAccess)
        return allAccess.then((all) => participationRequired(all.get(userId)?.accessibleNodeIds));
      if (!readAccess) throw new Error('Node access is not available in this view.');
      let ids = accessible.get(userId);
      if (!ids) {
        ids = roadmapNodeAccess(readAccess, transaction, userId, roadmapId);
        accessible.set(userId, ids);
      }
      return ids;
    },
    participantAccess() {
      if (!readRoadmapAccess) throw new Error('Roadmap access is not available in this view.');
      allAccess ??= readRoadmapAccess(transaction, roadmapId).then(
        ({ participants, accessibleByUser }) =>
          new Map(
            participants.map(({ userId, role }) => [
              userId,
              { userId, role, accessibleNodeIds: accessibleByUser.get(userId) ?? new Set() },
            ]),
          ),
      );
      return allAccess.then((all) => [...all.values()]);
    },
    dependencies() {
      allDependencies ??= transaction.dependency.findMany({
        where: { sourceNode: { roadmapId } },
        select: { id: true, sourceNodeId: true, targetNodeId: true },
        orderBy: { id: 'asc' },
      });
      return allDependencies;
    },
    dependency(sourceNodeId, targetNodeId) {
      if (allDependencies)
        return allDependencies.then(
          (all) =>
            all.find(
              (dependency) =>
                dependency.sourceNodeId === sourceNodeId &&
                dependency.targetNodeId === targetNodeId,
            ) ?? null,
        );
      return transaction.dependency.findFirst({
        where: { sourceNodeId, targetNodeId, sourceNode: { roadmapId } },
        select: { id: true, sourceNodeId: true, targetNodeId: true },
      });
    },
    nodeTypes() {
      allNodeTypes ??= transaction.nodeType
        .findMany({
          where: { roadmapId },
          select: {
            id: true,
            name: true,
            nodes: { where: { roadmapId, isVisible: true }, select: { id: true }, take: 1 },
          },
          orderBy: { id: 'asc' },
        })
        .then((types) =>
          types.map((type) => ({
            id: type.id,
            name: type.name,
            hasVisibleNode: type.nodes.length > 0,
          })),
        );
      return allNodeTypes;
    },
    nodeType(nodeTypeId) {
      if (allNodeTypes)
        return allNodeTypes.then((all) => all.find(({ id }) => id === nodeTypeId) ?? null);
      let nodeType = nodeTypes.get(nodeTypeId);
      if (!nodeType) {
        nodeType = transaction.nodeType
          .findFirst({
            where: { id: nodeTypeId, roadmapId },
            select: {
              id: true,
              name: true,
              nodes: { where: { roadmapId, isVisible: true }, select: { id: true }, take: 1 },
            },
          })
          .then((type) =>
            type ? { id: type.id, name: type.name, hasVisibleNode: type.nodes.length > 0 } : null,
          );
        nodeTypes.set(nodeTypeId, nodeType);
      }
      return nodeType;
    },
    async preload() {
      await Promise.all([
        view.nodes(),
        view.resources(),
        view.dependencies(),
        view.nodeTypes(),
        view.course(),
      ]);
    },
  };
  return view;
}
