import type { RoadmapNodePlacement } from '@/features/roadmap/canvas/commands/commands';
import {
  roadmapGridSize,
  roadmapNodeClearance,
  roadmapNodeSizeForTitle,
  snapToRoadmapGrid,
  type NodeRect,
  type RoadmapNodeSize,
  type Point,
} from '@/features/roadmap/graph/geometry';

export type CanvasNode = {
  readonly id: string;
  readonly title: string;
  readonly position: Point;
  readonly size?: RoadmapNodeSize;
};

const maxIterations = 50;

type NodeBox = NodeRect & { readonly id: string };
type Axis = 'x' | 'y';

function snapAwayFromOrigin(value: number, delta: number) {
  const cells = value / roadmapGridSize;
  return (delta > 0 ? Math.ceil(cells) : Math.floor(cells)) * roadmapGridSize || 0;
}

function clearanceOverlap(a: NodeBox, b: NodeBox) {
  const dx = a.x + a.width / 2 - (b.x + b.width / 2);
  const dy = a.y + a.height / 2 - (b.y + b.height / 2);
  const x = (a.width + b.width) / 2 + roadmapNodeClearance - Math.abs(dx);
  const y = (a.height + b.height) / 2 + roadmapNodeClearance - Math.abs(dy);
  if (x <= 0 || y <= 0) return null;
  const axis: Axis = x < y ? 'x' : 'y';
  return { axis, amount: axis === 'x' ? x : y, offset: axis === 'x' ? dx : dy };
}

export function placementsWithoutCollisions(
  nodes: readonly CanvasNode[],
  placed: readonly RoadmapNodePlacement[],
): RoadmapNodePlacement[] {
  const anchored = new Map(placed.map(({ nodeId, position }) => [nodeId, position]));
  const boxes: NodeBox[] = nodes
    .map(({ id, title, position, size }) => ({
      id,
      ...(anchored.get(id) ?? position),
      ...(size ?? roadmapNodeSizeForTitle(title)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const reached = new Set(anchored.keys());
  const pushed = new Set<string>();
  const push = (box: NodeBox, axis: Axis, delta: number) => {
    const snapped = snapToRoadmapGrid(box);
    const next = { ...snapped, [axis]: snapAwayFromOrigin(box[axis] + delta, delta) };
    boxes[boxes.indexOf(box)] = { ...box, ...next };
    reached.add(box.id);
    pushed.add(box.id);
  };

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let collided = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const aAnchored = anchored.has(a.id);
        const bAnchored = anchored.has(b.id);
        if ((aAnchored && bAnchored) || (!reached.has(a.id) && !reached.has(b.id))) continue;
        const overlap = clearanceOverlap(a, b);
        if (!overlap) continue;
        collided = true;
        const aYields = !aAnchored && (bAnchored || (reached.has(b.id) && !reached.has(a.id)));
        const offset = aYields ? overlap.offset : -overlap.offset;
        const away = offset < 0 ? -1 : 1;
        push(aYields ? a : b, overlap.axis, away * overlap.amount);
      }
    }
    if (!collided) break;
  }

  return [
    ...placed,
    ...boxes
      .filter(({ id }) => pushed.has(id))
      .map(({ id, x, y }) => ({ nodeId: id, position: { x, y } })),
  ];
}

export function nodesDisplacedByNewNode(
  nodes: readonly CanvasNode[],
  newNode: CanvasNode,
): RoadmapNodePlacement[] {
  return placementsWithoutCollisions(
    [...nodes, newNode],
    [{ nodeId: newNode.id, position: newNode.position }],
  ).slice(1);
}
