import { expect, test } from 'vitest';
import { reconcileFlow } from '@/features/roadmap/graph/flow-reconciliation';

const onAction = () => undefined;

function node(id: string, title: string, x = 0) {
  return {
    id,
    type: 'roadmap',
    data: { title, isHidden: false, onAction },
    position: { x, y: 0 },
    selected: false,
  };
}

function edge(id: string, source: string, target: string) {
  return {
    id,
    source,
    target,
    data: { defaultStroke: '#000', onDelete: onAction },
    style: { stroke: '#000', strokeWidth: 1.5 },
  };
}

const measured = { width: 240, height: 96 };

type TestFlow = {
  nodes: (ReturnType<typeof node> & { measured?: typeof measured })[];
  edges: ReturnType<typeof edge>[];
};

const current: TestFlow = {
  nodes: [
    { ...node('limits', 'Límites'), measured },
    { ...node('derivatives', 'Derivadas'), measured },
  ],
  edges: [edge('limits-derivatives', 'limits', 'derivatives')],
};

test('an unchanged refresh keeps the current flow', () => {
  const next: TestFlow = {
    nodes: [node('limits', 'Límites'), node('derivatives', 'Derivadas')],
    edges: [edge('limits-derivatives', 'limits', 'derivatives')],
  };

  expect(reconcileFlow(next, current)).toBe(current);
});

test('a refresh replaces only the Nodes and Dependencies whose data changed', () => {
  const next: TestFlow = {
    nodes: [node('limits', 'Límites'), node('derivatives', 'Derivadas II', 120)],
    edges: [
      edge('limits-derivatives', 'limits', 'derivatives'),
      edge('derivatives-limits', 'derivatives', 'limits'),
    ],
  };

  const reconciled = reconcileFlow(next, current);

  expect(reconciled.nodes[0]).toBe(current.nodes[0]);
  expect(reconciled.nodes[1]).toEqual({ ...node('derivatives', 'Derivadas II', 120), measured });
  expect(reconciled.edges[0]).toBe(current.edges[0]);
  expect(reconciled.edges[1]).toEqual(edge('derivatives-limits', 'derivatives', 'limits'));
});

test('a removed Dependency leaves the remaining objects in place', () => {
  const next: TestFlow = { nodes: [node('limits', 'Límites')], edges: [] };
  const reconciled = reconcileFlow(next, current);

  expect(reconciled.nodes).toEqual([current.nodes[0]]);
  expect(reconciled.nodes[0]).toBe(current.nodes[0]);
  expect(reconciled.edges).toEqual([]);
});
