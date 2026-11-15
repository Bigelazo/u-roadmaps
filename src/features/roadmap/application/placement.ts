import 'server-only';
import type { Prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';
import { requireUuid } from '@/shared/validation';
import { requireFiniteNumber } from './validation';
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
) {
  if (!positions.length) return;
  const count = await tx.roadmapNode.count({
    where: { roadmapId, id: { in: positions.map(({ nodeId }) => nodeId) } },
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
