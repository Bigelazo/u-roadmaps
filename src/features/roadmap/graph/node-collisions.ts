import {
  roadmapGridSize,
  roadmapNodeClearance,
  roadmapNodeSizeForTitle,
  type Point,
} from '@/features/roadmap/graph/geometry';

export type CanvasNode = { readonly id: string; readonly title: string; readonly position: Point };
export type CanvasNodePlacement = { readonly nodeId: string; readonly position: Point };

const maxIterations = 50;

type Box = { id: string; x: number; y: number; width: number; height: number };

function snapAway(value: number, direction: number) {
  const cells = value / roadmapGridSize;
  return (direction > 0 ? Math.ceil(cells) : Math.floor(cells)) * roadmapGridSize || 0;
}

export function placementsWithoutCollisions(
  nodes: readonly CanvasNode[],
  placed: readonly CanvasNodePlacement[],
): CanvasNodePlacement[] {
  const anchored = new Map(placed.map(({ nodeId, position }) => [nodeId, position]));
  const boxes: Box[] = nodes
    .map(({ id, title, position }) => ({
      id,
      ...(anchored.get(id) ?? position),
      ...roadmapNodeSizeForTitle(title),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const active = new Set(anchored.keys());
  const displaced = new Set<string>();
  const push = (box: Box, axis: 'x' | 'y', delta: number) => {
    if (delta === 0) return;
    const cross = axis === 'x' ? 'y' : 'x';
    box[axis] = snapAway(box[axis] + delta, delta);
    box[cross] = Math.round(box[cross] / roadmapGridSize) * roadmapGridSize || 0;
    active.add(box.id);
    displaced.add(box.id);
  };

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let collided = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const aAnchored = anchored.has(a.id);
        const bAnchored = anchored.has(b.id);
        if ((aAnchored && bAnchored) || (!active.has(a.id) && !active.has(b.id))) continue;
        const dx = a.x + a.width / 2 - (b.x + b.width / 2);
        const dy = a.y + a.height / 2 - (b.y + b.height / 2);
        const overlapX = (a.width + b.width) / 2 + roadmapNodeClearance - Math.abs(dx);
        const overlapY = (a.height + b.height) / 2 + roadmapNodeClearance - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        collided = true;
        const axis = overlapX < overlapY ? 'x' : 'y';
        const overlap = axis === 'x' ? overlapX : overlapY;
        const offset = axis === 'x' ? dx : dy;
        const movesA = !aAnchored && (bAnchored || (active.has(b.id) && !active.has(a.id)));
        if (movesA) push(a, axis, (offset < 0 ? -1 : 1) * overlap);
        else push(b, axis, (offset > 0 ? -1 : 1) * overlap);
      }
    }
    if (!collided) break;
  }

  return [
    ...placed,
    ...boxes
      .filter(({ id }) => displaced.has(id))
      .map(({ id, x, y }) => ({ nodeId: id, position: { x, y } })),
  ];
}
