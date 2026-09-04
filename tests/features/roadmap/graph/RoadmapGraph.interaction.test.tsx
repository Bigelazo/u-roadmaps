import { useState, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  ConnectionMode: { Loose: 'loose' },
  Handle: () => null,
  MarkerType: { ArrowClosed: 'arrow-closed' },
  Panel: ({ children }: { children: ReactNode }) => <>{children}</>,
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
  ReactFlow: ({
    nodes,
    onNodesChange,
    onNodeClick,
  }: {
    nodes: { id: string; position: { x: number; y: number }; data: object }[];
    onNodesChange: (changes: unknown[]) => void;
    onNodeClick: (event: { currentTarget: HTMLElement }, node: (typeof nodes)[number]) => void;
  }) => (
    <>
      <output data-testid="node-position">{`${nodes[0].position.x},${nodes[0].position.y}`}</output>
      <button
        type="button"
        onClick={() =>
          onNodesChange([{ id: 'node-1', type: 'position', position: { x: 200, y: 160 } }])
        }
      >
        Arrastrar nodo
      </button>
      <button type="button" onClick={() => onNodeClick({ currentTarget: document.body }, nodes[0])}>
        Seleccionar nodo
      </button>
    </>
  ),
  applyEdgeChanges: <T,>(changes: T[], edges: T[]) => edges,
  applyNodeChanges: <T extends { id: string; position: { x: number; y: number } }>(
    changes: { id: string; type: string; position?: { x: number; y: number } }[],
    nodes: T[],
  ) =>
    nodes.map((node) => {
      const change = changes.find(
        (candidate) => candidate.id === node.id && candidate.type === 'position',
      );
      return change?.position ? { ...node, position: change.position } : node;
    }),
  useReactFlow: () => ({ screenToFlowPosition: (position: { x: number; y: number }) => position }),
}));

import { RoadmapGraph } from '@/features/roadmap/graph/RoadmapGraph';
import type { RoadmapDto } from '@/features/roadmap/types';

const roadmap: RoadmapDto = {
  course: { code: 'CC1001', name: 'Introducción', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [{ id: 'content', name: 'Contenido', color: '#024AD8', isPredefined: true }],
  nodes: [
    {
      id: 'node-1',
      title: 'Límites',
      description: null,
      positionX: 0,
      positionY: 0,
      nodeTypeId: 'content',
      isVisible: true,
      isTeacherBlocked: false,
      resources: [],
    },
  ],
  dependencies: [],
};

function GraphHarness() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  return (
    <RoadmapGraph
      roadmap={roadmap}
      canEdit
      selectedNodeId={selectedNodeId}
      onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
      onMoveNode={vi.fn()}
      onConnectNodes={vi.fn()}
      onDeleteDependencies={vi.fn()}
      onAutoLayout={vi.fn()}
    />
  );
}

test('keeps a dragged node position when selecting it before the roadmap reloads', async () => {
  const user = userEvent.setup();
  render(<GraphHarness />);

  await user.click(screen.getByRole('button', { name: 'Arrastrar nodo' }));
  expect(screen.getByTestId('node-position').textContent).toBe('200,160');

  await user.click(screen.getByRole('button', { name: 'Seleccionar nodo' }));
  expect(screen.getByTestId('node-position').textContent).toBe('200,160');
});
