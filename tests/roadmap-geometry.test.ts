import { expect, it } from 'vitest';
import { Position } from '@xyflow/react';
import {
  floatingEdgeGeometry,
  nearestSide,
  nodeCenter,
  roadmapGridSize,
  roadmapNodeSize,
  sideAnchor,
  snapToRoadmapGrid,
} from '@/lib/roadmap-geometry';

const card = (x: number, y: number) => ({ x, y, width: 190, height: 120 });

it('leaves through the side that faces the other node', () => {
  // Nodos contiguos en la misma fila: costado derecho hacia el izquierdo.
  const row = floatingEdgeGeometry(card(480, 0), card(720, 0));
  expect(row.sourcePosition).toBe(Position.Right);
  expect(row.targetPosition).toBe(Position.Left);

  // Salto de fila hacia atrás: el eje horizontal domina, así que sale por la izquierda.
  const wrap = floatingEdgeGeometry(card(960, 0), card(0, 170));
  expect(wrap.sourcePosition).toBe(Position.Left);
  expect(wrap.targetPosition).toBe(Position.Right);

  // Nodo claramente debajo: el eje vertical domina.
  const down = floatingEdgeGeometry(card(-287, -254), card(0, 170));
  expect(down.sourcePosition).toBe(Position.Bottom);
  expect(down.targetPosition).toBe(Position.Top);
});

it('anchors the edge on the midpoint of the chosen side', () => {
  const rect = card(100, 200);
  expect(sideAnchor(rect, Position.Top)).toEqual({ x: 195, y: 200 });
  expect(sideAnchor(rect, Position.Bottom)).toEqual({ x: 195, y: 320 });
  expect(sideAnchor(rect, Position.Left)).toEqual({ x: 100, y: 260 });
  expect(sideAnchor(rect, Position.Right)).toEqual({ x: 290, y: 260 });
});

it('gives the two ends opposing sides', () => {
  const pairs: [Position, Position][] = [
    [Position.Right, Position.Left],
    [Position.Left, Position.Right],
    [Position.Bottom, Position.Top],
    [Position.Top, Position.Bottom],
  ];
  for (const [x, y] of [
    [400, 0],
    [-400, 0],
    [0, 400],
    [0, -400],
  ]) {
    const { sourcePosition, targetPosition } = floatingEdgeGeometry(card(0, 0), card(x, y));
    expect(pairs).toContainEqual([sourcePosition, targetPosition]);
  }
});

it('ignores ties in favour of the vertical axis', () => {
  expect(nearestSide({ x: 0, y: 0 }, { x: 100, y: 100 })).toBe(Position.Bottom);
});

it('snaps node positions to the roadmap grid before saving them', () => {
  expect(roadmapGridSize).toBe(20);
  expect(snapToRoadmapGrid({ x: 149, y: 151 })).toEqual({ x: 140, y: 160 });
  expect(snapToRoadmapGrid({ x: -31, y: -29 })).toEqual({ x: -40, y: -20 });
});

it('keeps the centers and aligned edge anchors on the roadmap grid', () => {
  const source = { ...snapToRoadmapGrid({ x: 120, y: 80 }), ...roadmapNodeSize };
  const target = { ...snapToRoadmapGrid({ x: 120, y: 420 }), ...roadmapNodeSize };
  const edge = floatingEdgeGeometry(source, target);

  expect(roadmapNodeSize.width % roadmapGridSize).toBe(0);
  expect(roadmapNodeSize.height % roadmapGridSize).toBe(0);
  expect(nodeCenter(source).x % roadmapGridSize).toBe(0);
  expect(nodeCenter(source).y % roadmapGridSize).toBe(0);
  expect(nodeCenter(target).x % roadmapGridSize).toBe(0);
  expect(nodeCenter(target).y % roadmapGridSize).toBe(0);
  expect(edge.sourceX).toBe(edge.targetX);
  expect(edge.sourcePosition).toBe(Position.Bottom);
  expect(edge.targetPosition).toBe(Position.Top);

  const row = floatingEdgeGeometry(source, {
    ...snapToRoadmapGrid({ x: 620, y: 80 }),
    ...roadmapNodeSize,
  });
  expect(row.sourceY).toBe(row.targetY);
  expect(row.sourcePosition).toBe(Position.Right);
  expect(row.targetPosition).toBe(Position.Left);
});
