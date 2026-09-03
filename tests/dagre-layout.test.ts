import { Position } from '@xyflow/react';
import { expect, test } from 'vitest';
import { layoutRoadmapGraph } from '../src/features/roadmap/graph/dagre-layout';
import { roadmapNodeSizeForTitle } from '../src/features/roadmap/graph/geometry';
import type { RoadmapFlowEdge } from '../src/features/roadmap/graph/DependencyEdge';
import type { RoadmapFlowNode } from '../src/features/roadmap/graph/RoadmapNode';

const nodes: RoadmapFlowNode[] = [
  {
    id: 'start',
    type: 'roadmap',
    position: { x: 420, y: 200 },
    data: {
      title: 'Inicio',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      status: 'editing',
      isHidden: false,
    },
  },
  {
    id: 'end',
    type: 'roadmap',
    position: { x: 0, y: 0 },
    data: {
      title: 'Final',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      status: 'editing',
      isHidden: false,
    },
  },
];

const edges: RoadmapFlowEdge[] = [
  {
    id: 'start-end',
    source: 'start',
    target: 'end',
    type: 'dependency',
  },
];

function findLayoutedPair(direction: 'TB' | 'LR') {
  const layoutedNodes = layoutRoadmapGraph(nodes, edges, direction);
  const start = layoutedNodes.find((node) => node.id === 'start');
  const end = layoutedNodes.find((node) => node.id === 'end');

  expect(start).toBeDefined();
  expect(end).toBeDefined();
  if (!start || !end) throw new Error('Faltan nodos del layout.');
  return { start, end };
}

test('places prerequisite nodes above their dependants on the roadmap grid vertically', () => {
  const { start, end } = findLayoutedPair('TB');

  expect(start.position.y).toBeLessThan(end.position.y);
  expect(start.sourcePosition).toBe(Position.Bottom);
  expect(start.targetPosition).toBe(Position.Top);
  expect(start.position.x % 20).toBe(0);
  expect(start.position.y % 20).toBe(0);
  expect(end.position.x % 20).toBe(0);
  expect(end.position.y % 20).toBe(0);
});

test('places prerequisite nodes before their dependants horizontally', () => {
  const { start, end } = findLayoutedPair('LR');

  expect(start.position.x).toBeLessThan(end.position.x);
  expect(start.sourcePosition).toBe(Position.Right);
  expect(start.targetPosition).toBe(Position.Left);
  expect(start.position.x % 20).toBe(0);
  expect(start.position.y % 20).toBe(0);
  expect(end.position.x % 20).toBe(0);
  expect(end.position.y % 20).toBe(0);
});

test('uses title-based card dimensions instead of measured dimensions', () => {
  const nodesWithIrregularMeasurements = nodes.map((node, index) => ({
    ...node,
    measured: index === 0 ? { width: 500, height: 300 } : { width: 60, height: 40 },
  }));

  const layouted = layoutRoadmapGraph(nodesWithIrregularMeasurements, edges, 'TB');
  const start = layouted.find((node) => node.id === 'start');
  const end = layouted.find((node) => node.id === 'end');

  expect(start?.position.x).toBe(end?.position.x);
  expect(roadmapNodeSizeForTitle('Inicio')).toEqual({ width: 160, height: 120 });
});

test('returns the same grid-aligned layout for repeated requests', () => {
  const first = layoutRoadmapGraph(nodes, edges, 'TB');
  const second = layoutRoadmapGraph(nodes, edges, 'TB');

  expect(first.map((node) => node.position)).toEqual(second.map((node) => node.position));
  for (const node of first) {
    expect(node.position.x % 20).toBe(0);
    expect(node.position.y % 20).toBe(0);
  }
});
