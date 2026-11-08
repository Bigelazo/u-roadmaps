import { expect, test } from 'vitest';
import type { RoadmapNodePlacement } from '@/features/roadmap/canvas/commands/commands';
import {
  roadmapGridSize,
  roadmapNodeSizeForTitle,
  type NodeRect,
} from '@/features/roadmap/graph/geometry';
import {
  placementsWithoutCollisions,
  type CanvasNode,
} from '@/features/roadmap/graph/node-collisions';

const clearance = 2 * roadmapGridSize;

function node(id: string, x: number, y: number, title = 'Nodo'): CanvasNode {
  return { id, title, position: { x, y } };
}

function layout(nodes: readonly CanvasNode[], placements: readonly RoadmapNodePlacement[]) {
  const moved = new Map(placements.map(({ nodeId, position }) => [nodeId, position]));
  return nodes.map(({ id, title, position }) => ({
    id,
    ...(moved.get(id) ?? position),
    ...roadmapNodeSizeForTitle(title),
  }));
}

function tooClose(a: NodeRect, b: NodeRect) {
  return (
    a.x < b.x + b.width + clearance &&
    b.x < a.x + a.width + clearance &&
    a.y < b.y + b.height + clearance &&
    b.y < a.y + a.height + clearance
  );
}

function crowdedPairs(rects: readonly (NodeRect & { id: string })[]) {
  return rects.flatMap((a, i) =>
    rects.slice(i + 1).flatMap((b) => (tooClose(a, b) ? [`${a.id}-${b.id}`] : [])),
  );
}

test('pushes the Nodes a drop lands on, and the Nodes they reach, two grid cells away', () => {
  const nodes = [node('a', 0, 0), node('b', 300, 0), node('c', 300, 140), node('d', 900, 900)];
  const placed = [{ nodeId: 'a', position: { x: 300, y: 40 } }];

  const placements = placementsWithoutCollisions(nodes, placed);

  expect(placements[0]).toEqual(placed[0]);
  expect(placements.map(({ nodeId }) => nodeId).sort()).toEqual(['a', 'b', 'c']);
  const rects = layout(nodes, placements);
  expect(crowdedPairs(rects)).toEqual([]);
  for (const { x, y } of rects) {
    expect(Math.abs(x % roadmapGridSize)).toBe(0);
    expect(Math.abs(y % roadmapGridSize)).toBe(0);
  }
});

test('keeps dragged Nodes where they were dropped and leaves untouched overlaps alone', () => {
  const nodes = [
    node('a', 0, 0),
    node('b', 0, 0),
    node('c', 200, 0),
    node('far', 1000, 1000),
    node('far-twin', 1010, 1010),
  ];
  const placed = [
    { nodeId: 'a', position: { x: 600, y: 600 } },
    { nodeId: 'b', position: { x: 620, y: 620 } },
  ];

  expect(placementsWithoutCollisions(nodes, placed)).toEqual(placed);
});

test('resolves the same collision identically regardless of the Node order', () => {
  const nodes = [node('a', 0, 0), node('b', 320, 120), node('c', 360, 40), node('d', 160, 160)];
  const placed = [{ nodeId: 'a', position: { x: 360, y: 120 } }];

  const forward = placementsWithoutCollisions(nodes, placed);
  const backward = placementsWithoutCollisions([...nodes].reverse(), placed);

  expect(new Set(backward)).toEqual(new Set(forward));
  expect(crowdedPairs(layout(nodes, forward))).toEqual([]);
});

test('moves Nodes saved off the grid onto grid positions that keep the clearance', () => {
  const nodes = [node('a', 0, 0), node('b', 157, 13)];

  const placements = placementsWithoutCollisions(nodes, [
    { nodeId: 'a', position: { x: 100, y: 0 } },
  ]);

  expect(placements).toEqual([
    { nodeId: 'a', position: { x: 100, y: 0 } },
    { nodeId: 'b', position: { x: 260, y: 20 } },
  ]);
});

test('separates a pile of Nodes dropped on the same spot within its iteration bound', () => {
  const nodes = Array.from({ length: 12 }, (_, i) => node(String(i).padStart(2, '0'), 0, 0));

  const placements = placementsWithoutCollisions(nodes, [
    { nodeId: '00', position: { x: 0, y: 0 } },
  ]);

  expect(placements).toHaveLength(12);
  expect(crowdedPairs(layout(nodes, placements))).toEqual([]);
});
