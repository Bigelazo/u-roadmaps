import { expect, it } from 'vitest';
import { Position } from '@xyflow/react';
import {
  floatingEdgeGeometry,
  findOpenRoadmapPosition,
  nearestSide,
  nodeCenter,
  roadmapGridSize,
  roadmapNodeSizeForTitle,
  sideAnchor,
  snapToRoadmapGrid,
} from '@/features/roadmap/graph/geometry';

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

it('keeps a free requested position and moves an occupied one to a grid-aligned gap', () => {
  const size = roadmapNodeSizeForTitle('Nuevo hito');
  const desired = { x: 240, y: 160 };
  const viewport = { x: 0, y: 0, width: 1_000, height: 1_000 };

  expect(findOpenRoadmapPosition([], desired, size, viewport)).toEqual(desired);

  const occupied = [{ ...desired, ...size }];
  const position = findOpenRoadmapPosition(occupied, desired, size, viewport);
  expect(position).toBeTruthy();
  const candidate = { ...position!, ...size };

  expect(position).not.toEqual(desired);
  expect(position!.x % roadmapGridSize).toBe(0);
  expect(position!.y % roadmapGridSize).toBe(0);
  expect(
    candidate.x + candidate.width + roadmapGridSize <= occupied[0].x ||
      occupied[0].x + occupied[0].width + roadmapGridSize <= candidate.x ||
      candidate.y + candidate.height + roadmapGridSize <= occupied[0].y ||
      occupied[0].y + occupied[0].height + roadmapGridSize <= candidate.y,
  ).toBe(true);
});

it('keeps an occupied viewport center inside the visible canvas while finding a gap', () => {
  const size = roadmapNodeSizeForTitle('Nuevo hito');
  const desired = { x: 160, y: 60 };
  const viewport = { x: 0, y: 0, width: 500, height: 400 };
  const position = findOpenRoadmapPosition([{ ...desired, ...size }], desired, size, viewport);

  expect(position).toBeTruthy();
  expect(position?.x).toBeGreaterThanOrEqual(viewport.x);
  expect(position?.y).toBeGreaterThanOrEqual(viewport.y);
  expect(position!.x + size.width).toBeLessThanOrEqual(viewport.x + viewport.width);
  expect(position!.y + size.height).toBeLessThanOrEqual(viewport.y + viewport.height);
});

it('keeps the centers and aligned edge anchors on the roadmap grid', () => {
  const sourceSize = roadmapNodeSizeForTitle('Introducción');
  const targetSize = roadmapNodeSizeForTitle('Funciones recursivas');
  const source = { ...snapToRoadmapGrid({ x: 120, y: 80 }), ...sourceSize };
  const target = {
    ...snapToRoadmapGrid({
      x: source.x + sourceSize.width / 2 - targetSize.width / 2,
      y: 420,
    }),
    ...targetSize,
  };
  const edge = floatingEdgeGeometry(source, target);

  expect(sourceSize.width % roadmapGridSize).toBe(0);
  expect(sourceSize.height % roadmapGridSize).toBe(0);
  expect(targetSize.width % roadmapGridSize).toBe(0);
  expect(targetSize.height % roadmapGridSize).toBe(0);
  expect(nodeCenter(source).x % roadmapGridSize).toBe(0);
  expect(nodeCenter(source).y % roadmapGridSize).toBe(0);
  expect(nodeCenter(target).x % roadmapGridSize).toBe(0);
  expect(nodeCenter(target).y % roadmapGridSize).toBe(0);
  expect(edge.sourceX).toBe(edge.targetX);
  expect(edge.sourcePosition).toBe(Position.Bottom);
  expect(edge.targetPosition).toBe(Position.Top);

  const row = floatingEdgeGeometry(source, {
    ...snapToRoadmapGrid({ x: 620, y: 80 }),
    ...sourceSize,
  });
  expect(row.sourceY).toBe(row.targetY);
  expect(row.sourcePosition).toBe(Position.Right);
  expect(row.targetPosition).toBe(Position.Left);
});

it('sizes cards from their title while keeping every side on the grid', () => {
  const shortTitle = roadmapNodeSizeForTitle('Listas');
  const mediumTitle = roadmapNodeSizeForTitle('Práctica guiada');
  const twoLineTitle = roadmapNodeSizeForTitle('Laboratorio de integración imperativa');
  const fourLineTitle = roadmapNodeSizeForTitle(
    'Evaluación final sobre diseño de programas y resolución de problemas',
  );
  const longTitle = roadmapNodeSizeForTitle(
    'Un título deliberadamente muy largo que necesita varias líneas para leerse completo',
  );

  expect(shortTitle).toEqual({ width: 160, height: 80 });
  expect(mediumTitle.width).toBeGreaterThan(shortTitle.width);
  expect(twoLineTitle).toEqual({ width: 240, height: 80 });
  expect(fourLineTitle).toEqual({ width: 240, height: 120 });
  expect(longTitle.width).toBeGreaterThanOrEqual(mediumTitle.width);
  expect(longTitle.height).toBeGreaterThan(shortTitle.height);
  for (const size of [shortTitle, mediumTitle, longTitle]) {
    expect(size.width % roadmapGridSize).toBe(0);
    expect(size.height % roadmapGridSize).toBe(0);
  }
});
