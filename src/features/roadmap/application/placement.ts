import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';
import { requireUuid } from '@/shared/validation';
import { nodeTypeNotFound } from '@/features/roadmap/domain/node-type';
import { nodeDto } from './roadmap';
import { nodeDescription, requireBoolean, requireFiniteNumber, requireString } from './validation';
import { roadmapCommand } from './roadmap-command';
import { nodeNotFound } from './errors';

type NodePosition = { nodeId: string; position: { x: number; y: number } };

function parsePositions(value: unknown): NodePosition[] {
  if (!Array.isArray(value))
    throw new ApplicationError(400, 'INVALID_REQUEST', 'positions debe ser una lista.');
  const targets = new Set<string>();
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('nodeId' in item) || !('position' in item))
      throw new ApplicationError(400, 'INVALID_REQUEST', 'Cada posición debe identificar un nodo.');
    const nodeId = requireUuid(item.nodeId, 'nodeId').toLowerCase();
    if (targets.has(nodeId))
      throw new ApplicationError(400, 'INVALID_REQUEST', 'Cada nodo debe aparecer una sola vez.');
    targets.add(nodeId);
    const position = item.position;
    if (
      typeof position !== 'object' ||
      position === null ||
      !('x' in position) ||
      !('y' in position)
    )
      throw new ApplicationError(400, 'INVALID_REQUEST', 'Cada posición debe contener x e y.');
    return {
      nodeId,
      position: {
        x: requireFiniteNumber(position.x, 'position.x'),
        y: requireFiniteNumber(position.y, 'position.y'),
      },
    };
  });
}

async function persistPositions(
  tx: Prisma.TransactionClient,
  roadmapId: string,
  positions: readonly NodePosition[],
  createdNodeId?: string,
) {
  if (!positions.length) return;
  const count = await tx.roadmapNode.count({
    where: {
      roadmapId,
      id: { in: positions.map(({ nodeId }) => nodeId), not: createdNodeId },
    },
  });
  if (count !== positions.length) throw nodeNotFound();
  for (const { nodeId, position } of positions)
    await tx.roadmapNode.update({
      where: { id: nodeId, roadmapId },
      data: { positionX: position.x, positionY: position.y },
    });
}

export const saveRoadmapNodePositions = roadmapCommand({
  capability: 'edit',
  parse: ({ input }: { input: Record<string, unknown> }) => parsePositions(input.positions),
  access: 'none',
  run: async ({ tx, roadmap, input: positions }) => {
    await persistPositions(tx, roadmap.id, positions);
    return { result: undefined, facts: [] };
  },
});

export const createRoadmapNode = roadmapCommand({
  capability: 'edit',
  parse: ({ input }: { input: Record<string, unknown> }) => ({
    nodeId:
      input.nodeId === undefined ? randomUUID() : requireUuid(input.nodeId, 'nodeId').toLowerCase(),
    title: requireString(input.title, 'title', 240),
    description: nodeDescription(input.description),
    nodeTypeId: requireUuid(input.nodeTypeId, 'nodeTypeId'),
    positionX: requireFiniteNumber(input.positionX, 'positionX'),
    positionY: requireFiniteNumber(input.positionY, 'positionY'),
    isVisible: input.isVisible === undefined ? true : requireBoolean(input.isVisible, 'isVisible'),
    displaced: parsePositions(input.displaced ?? []),
  }),
  access: 'none',
  run: async ({ tx, roadmap, input: { nodeId, displaced, ...content } }) => {
    const existing = await tx.roadmapNode.findUnique({ where: { id: nodeId } });
    if (existing) {
      if (existing.roadmapId !== roadmap.id) throw nodeNotFound();
      return { result: nodeDto(existing), facts: [] };
    }
    const nodeType = await tx.nodeType.findFirst({
      where: { id: content.nodeTypeId, OR: [{ isPredefined: true }, { roadmapId: roadmap.id }] },
    });
    if (!nodeType) {
      const failure = nodeTypeNotFound();
      throw new ApplicationError(404, failure.reason, failure.message);
    }
    const [node] = await tx.roadmapNode.createManyAndReturn({
      data: { id: nodeId, roadmapId: roadmap.id, ...content },
      skipDuplicates: true,
    });
    if (!node) {
      const recovered = await tx.roadmapNode.findUnique({ where: { id: nodeId } });
      if (!recovered || recovered.roadmapId !== roadmap.id) throw nodeNotFound();
      return { result: nodeDto(recovered), facts: [] };
    }
    await persistPositions(tx, roadmap.id, displaced, nodeId);
    return {
      result: nodeDto(node),
      facts: [{ kind: 'node-created', nodeId: node.id, previous: null, current: node }],
    };
  },
});
