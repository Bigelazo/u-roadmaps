import { useState, type ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

const { fitViewMock } = vi.hoisted(() => ({ fitViewMock: vi.fn() }));

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  ConnectionMode: { Loose: 'loose' },
  ControlButton: ({
    children,
    onClick,
    ...props
  }: {
    children: ReactNode;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Controls: ({ children }: { children: ReactNode }) => <>{children}</>,
  Handle: () => null,
  MarkerType: { ArrowClosed: 'arrow-closed' },
  Panel: ({ children }: { children: ReactNode }) => <>{children}</>,
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
  ReactFlow: ({
    nodes,
    onNodesChange,
    onNodeClick,
    children,
  }: {
    nodes: { id: string; position: { x: number; y: number }; data: object; selected?: boolean }[];
    onNodesChange: (changes: unknown[]) => void;
    onNodeClick: (event: { currentTarget: HTMLElement }, node: (typeof nodes)[number]) => void;
    children: ReactNode;
  }) => (
    <>
      <output data-testid="node-position">{`${nodes[0].position.x},${nodes[0].position.y}`}</output>
      <output data-testid="selected-node">{nodes.find((node) => node.selected)?.id ?? ''}</output>
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
      <button
        data-testid="keyboard-node"
        type="button"
        className="react-flow__node"
        data-id="node-1"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight')
            onNodesChange([{ id: 'node-1', type: 'position', position: { x: 20, y: 0 } }]);
        }}
      >
        Nodo con teclado
      </button>
      {children}
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
  useReactFlow: () => ({
    fitView: fitViewMock,
    screenToFlowPosition: (position: { x: number; y: number }) => position,
  }),
}));

import { RoadmapGraph } from '@/features/roadmap/graph/RoadmapGraph';
import type { RoadmapDto } from '@/features/roadmap/types';

const roadmap: RoadmapDto = {
  course: { code: 'CC1001', name: 'Introducción', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [
    { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
  ],
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
    {
      id: 'node-2',
      title: 'Derivadas',
      description: null,
      positionX: 300,
      positionY: 180,
      nodeTypeId: 'content',
      isVisible: true,
      isTeacherBlocked: false,
      resources: [],
    },
  ],
  dependencies: [],
};

function GraphHarness({
  panelWidth = 360,
  roadmapData = roadmap,
  initialSelectedNodeId = null,
}: {
  panelWidth?: number;
  roadmapData?: RoadmapDto;
  initialSelectedNodeId?: string | null;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialSelectedNodeId);
  return (
    <div style={{ width: panelWidth }}>
      <RoadmapGraph
        roadmap={roadmapData}
        canEdit
        selectedNodeId={selectedNodeId}
        onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
        onMoveNode={vi.fn()}
        onConnectNodes={vi.fn()}
        onDeleteDependencies={vi.fn()}
        onAutoLayout={vi.fn()}
      />
    </div>
  );
}

beforeEach(() => {
  fitViewMock.mockReset();
});

test('keeps a dragged node position when selecting it before the roadmap reloads', async () => {
  const user = userEvent.setup();
  render(<GraphHarness />);

  await user.click(screen.getByRole('button', { name: 'Arrastrar nodo' }));
  expect(screen.getByTestId('node-position').textContent).toBe('200,160');

  await user.click(screen.getByRole('button', { name: 'Seleccionar nodo' }));
  expect(screen.getByTestId('node-position').textContent).toBe('200,160');
});

test('keeps the selected node when refreshed roadmap data arrives', () => {
  const updatedRoadmap = structuredClone(roadmap);
  updatedRoadmap.nodes[1].title = 'Derivadas actualizadas';
  const { rerender } = render(<GraphHarness initialSelectedNodeId="node-2" />);

  rerender(<GraphHarness initialSelectedNodeId="node-2" roadmapData={updatedRoadmap} />);

  expect(screen.getByTestId('selected-node').textContent).toBe('node-2');
});

test('preserves the viewport when the editor panel width changes', async () => {
  vi.useFakeTimers();
  const { rerender } = render(<GraphHarness panelWidth={360} />);

  try {
    rerender(<GraphHarness panelWidth={460} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(32);
    });

    expect(fitViewMock).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

test('centers the roadmap from the canvas control', async () => {
  const user = userEvent.setup();
  render(<GraphHarness />);

  await user.click(screen.getByRole('button', { name: 'Centrar mapa' }));

  expect(fitViewMock).toHaveBeenCalledWith({ padding: 0.28 });
});

test('closes the selected node when Escape is pressed on the canvas node', async () => {
  const user = userEvent.setup();
  const onClearSelectedNode = vi.fn();
  render(
    <RoadmapGraph
      roadmap={roadmap}
      canEdit
      selectedNodeId="node-1"
      onSelectNode={vi.fn()}
      onMoveNode={vi.fn()}
      onConnectNodes={vi.fn()}
      onDeleteDependencies={vi.fn()}
      onAutoLayout={vi.fn()}
      onClearSelectedNode={onClearSelectedNode}
    />,
  );

  screen.getByTestId('keyboard-node').focus();
  await user.keyboard('{Escape}');
  expect(onClearSelectedNode).toHaveBeenCalledOnce();
});

test('reports a keyboard node move for persistence', async () => {
  const user = userEvent.setup();
  const onKeyboardNodeMove = vi.fn();
  render(
    <RoadmapGraph
      roadmap={roadmap}
      canEdit
      selectedNodeId="node-1"
      onSelectNode={vi.fn()}
      onMoveNode={vi.fn()}
      onConnectNodes={vi.fn()}
      onDeleteDependencies={vi.fn()}
      onAutoLayout={vi.fn()}
      onKeyboardNodeMove={onKeyboardNodeMove}
    />,
  );

  screen.getByTestId('keyboard-node').focus();
  await user.keyboard('{ArrowRight}');
  expect(onKeyboardNodeMove).toHaveBeenCalledWith('node-1', { x: 20, y: 0 });
});

test('requires confirmation before automatically ordering canvas nodes', async () => {
  const user = userEvent.setup();
  const onAutoLayout = vi.fn();
  render(
    <RoadmapGraph
      roadmap={roadmap}
      canEdit
      onSelectNode={vi.fn()}
      onMoveNode={vi.fn()}
      onConnectNodes={vi.fn()}
      onDeleteDependencies={vi.fn()}
      onAutoLayout={onAutoLayout}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Ordenar horizontalmente' }));

  expect(screen.getByRole('alertdialog', { name: 'Confirmar ordenamiento' })).not.toBeNull();
  expect(onAutoLayout).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onAutoLayout).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Ordenar horizontalmente' }));
  await user.click(screen.getByRole('button', { name: 'Ordenar nodos' }));

  expect(onAutoLayout).toHaveBeenCalledTimes(1);
});
