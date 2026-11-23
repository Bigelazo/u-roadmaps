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

export type ParticipantAccessReader = (
  transaction: Prisma.TransactionClient,
  query: { userId: string; roadmapIds: readonly string[] },
) => Promise<ReadonlyMap<string, ReadonlySet<string>>>;

export type RoadmapAccessReader = (
  transaction: Prisma.TransactionClient,
  roadmapId: string,
) => Promise<
  Readonly<{
    participants: readonly { userId: string; role: ParticipantAccess['role'] }[];
    accessibleByUser: ReadonlyMap<string, ReadonlySet<string>>;
  }>
>;

function participationRequired(accessible: ReadonlySet<string> | undefined) {
  if (!accessible) throw new ApplicationError(403, 'FORBIDDEN', 'No tienes acceso a este Roadmap.');
  return accessible;
}

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

function viewNodeType(type: { id: string; name: string; nodes: unknown[] }): RoadmapViewNodeType {
  return { id: type.id, name: type.name, hasVisibleNode: type.nodes.length > 0 };
}

const resourceOrder = [{ createdAt: 'asc' }, { id: 'asc' }] as const;
const dependencySelect = { id: true, sourceNodeId: true, targetNodeId: true } as const;

function firstBy<Row>(rows: readonly Row[], key: (row: Row) => string) {
  const index = new Map<string, Row>();
  for (const row of rows) if (!index.has(key(row))) index.set(key(row), row);
  return index;
}

const byId = ({ id }: { id: string }) => id;
const dependencyKey = ({
  sourceNodeId,
  targetNodeId,
}: Pick<RoadmapViewDependency, 'sourceNodeId' | 'targetNodeId'>) =>
  JSON.stringify([sourceNodeId, targetNodeId]);

function memo<Value>(cache: Map<string, Promise<Value>>, id: string, load: () => Promise<Value>) {
  let value = cache.get(id);
  if (!value) cache.set(id, (value = load()));
  return value;
}

function collection<Row>(key: (row: NoInfer<Row>) => string, load: () => Promise<readonly Row[]>) {
  let rows: Promise<readonly Row[]> | undefined;
  let index: Promise<ReadonlyMap<string, Row>> | undefined;
  const single = new Map<string, Promise<Row | null>>();
  const uncached = (id: string, one: () => Promise<Row | null>) => {
    if (!rows) return one();
    index ??= rows.then((all) => firstBy(all, key));
    return index.then((found) => found.get(id) ?? null);
  };
  return {
    all: () => (rows ??= load()),
    loaded: () => rows,
    uncached,
    cached: (id: string, one: () => Promise<Row | null>) =>
      uncached(id, () => memo(single, id, one)),
  };
}

export function roadmapView(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  readAccess?: ParticipantAccessReader,
  readRoadmapAccess?: RoadmapAccessReader,
): RoadmapView {
  let participants: ReturnType<RoadmapView['participants']> | undefined;
  let allAccess: Promise<ReadonlyMap<string, ParticipantAccess>> | undefined;
  let course: ReturnType<RoadmapView['course']> | undefined;
  let resourcesByNode: Promise<ReadonlyMap<string, readonly RoadmapViewResource[]>> | undefined;
  const roles = new Map<string, Promise<ParticipantRole | null>>();
  const accessible = new Map<string, Promise<ReadonlySet<string>>>();
  const nodeResources = new Map<string, ReturnType<RoadmapView['nodeResources']>>();
  const nodeTypeSelect = {
    id: true,
    name: true,
    nodes: { where: { roadmapId, isVisible: true }, select: { id: true }, take: 1 },
  } as const;
  const nodes = collection(byId, () =>
    transaction.roadmapNode
      .findMany({ where: { roadmapId }, select: nodeSelect, orderBy: { id: 'asc' } })
      .then((rows) => rows.map(viewNode)),
  );
  const resources = collection(byId, () =>
    transaction.resource
      .findMany({ where: { roadmapNode: { roadmapId } }, orderBy: [...resourceOrder] })
      .then((rows) => rows.map(viewResource)),
  );
  const dependencies = collection(dependencyKey, () =>
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: dependencySelect,
      orderBy: { id: 'asc' },
    }),
  );
  const nodeTypes = collection(byId, () =>
    transaction.nodeType
      .findMany({ where: { roadmapId }, select: nodeTypeSelect, orderBy: { id: 'asc' } })
      .then((rows) => rows.map(viewNodeType)),
  );
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
      if (allAccess) return allAccess.then((all) => all.get(userId)?.role ?? null);
      if (participants)
        return participants.then((all) => all.find((one) => one.userId === userId)?.role ?? null);
      return memo(roles, userId, () =>
        transaction.participation
          .findFirst({
            where: { userId, courseOffering: { roadmap: { id: roadmapId } }, isActive: true },
            select: { role: true },
          })
          .then((found) => found?.role ?? null),
      );
    },
    nodes: nodes.all,
    node: (nodeId) =>
      nodes.cached(nodeId, () =>
        transaction.roadmapNode
          .findFirst({ where: { id: nodeId, roadmapId }, select: nodeSelect })
          .then((found) => (found ? viewNode(found) : null)),
      ),
    resources: resources.all,
    resource: (resourceId) =>
      resources.cached(resourceId, () =>
        transaction.resource
          .findFirst({ where: { id: resourceId, roadmapNode: { roadmapId } } })
          .then((row) => (row ? viewResource(row) : null)),
      ),
    nodeResources(nodeId) {
      const all = resources.loaded();
      if (all) {
        resourcesByNode ??= all.then((rows) => Map.groupBy(rows, ({ nodeId: id }) => id));
        return resourcesByNode.then((groups) => [...(groups.get(nodeId) ?? [])]);
      }
      return memo(nodeResources, nodeId, () =>
        transaction.resource
          .findMany({
            where: { roadmapNodeId: nodeId, roadmapNode: { roadmapId } },
            orderBy: [...resourceOrder],
          })
          .then((rows) => rows.map(viewResource)),
      );
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
      return memo(accessible, userId, () =>
        roadmapNodeAccess(readAccess, transaction, userId, roadmapId),
      );
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
    dependencies: dependencies.all,
    dependency: (sourceNodeId, targetNodeId) =>
      dependencies.uncached(dependencyKey({ sourceNodeId, targetNodeId }), () =>
        transaction.dependency.findFirst({
          where: { sourceNodeId, targetNodeId, sourceNode: { roadmapId } },
          select: dependencySelect,
        }),
      ),
    nodeType: (nodeTypeId) =>
      nodeTypes.cached(nodeTypeId, () =>
        transaction.nodeType
          .findFirst({ where: { id: nodeTypeId, roadmapId }, select: nodeTypeSelect })
          .then((type) => (type ? viewNodeType(type) : null)),
      ),
    nodeTypes: nodeTypes.all,
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
