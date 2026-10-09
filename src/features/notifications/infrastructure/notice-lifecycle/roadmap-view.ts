import 'server-only';
import type { Prisma } from '@/shared/server/db';
import { resourceContentState } from '@/shared/server/resource-content-state';
import type {
  RoadmapView,
  RoadmapViewDependency,
  RoadmapViewNode,
  RoadmapViewNodeType,
  RoadmapViewResource,
} from '../../application/notice-targets';

export type NodeAccessReader = (
  transaction: Prisma.TransactionClient,
  userId: string,
  roadmapId: string,
) => Promise<ReadonlySet<string>>;

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
 * is loaded (`nodes`, `resources`, ..., or `preload`), lookups answer from it.
 */
export function roadmapView(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  accessibleNodes?: NodeAccessReader,
): RoadmapView {
  let participants: ReturnType<RoadmapView['participants']> | undefined;
  let allNodes: Promise<readonly RoadmapViewNode[]> | undefined;
  let allResources: Promise<readonly RoadmapViewResource[]> | undefined;
  let allDependencies: Promise<readonly RoadmapViewDependency[]> | undefined;
  let allNodeTypes: Promise<readonly RoadmapViewNodeType[]> | undefined;
  const nodes = new Map<string, Promise<RoadmapViewNode | null>>();
  const resources = new Map<string, Promise<RoadmapViewResource | null>>();
  const accessible = new Map<string, Promise<ReadonlySet<string>>>();
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
      if (!accessibleNodes) throw new Error('Node access is not available in this view.');
      let ids = accessible.get(userId);
      if (!ids) {
        ids = accessibleNodes(transaction, userId, roadmapId);
        accessible.set(userId, ids);
      }
      return ids;
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
