import { useState, type ReactNode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

const { fitViewMock, screenToFlowPositionMock, setViewportMock, reactFlowHandlers } = vi.hoisted(
  () => ({
    fitViewMock: vi.fn(),
    screenToFlowPositionMock: vi.fn((position: { x: number; y: number }) => position),
    setViewportMock: vi.fn(),
    reactFlowHandlers: {
      onMoveEnd: undefined as
        | ((event: object | null, viewport: { x: number; y: number; zoom: number }) => void)
        | undefined,
    },
  }),
);

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
  Panel: ({ children, position, ...props }: { children: ReactNode; position: string }) => (
    <div data-testid={`roadmap-panel-${position}`} {...props}>
      {children}
    </div>
  ),
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
  ReactFlow: ({
    nodes,
    onNodesChange,
    onNodeClick,
    onConnect,
    onEdgesDelete,
    onNodeDragStop,
    onMoveEnd,
    children,
  }: {
    nodes: { id: string; position: { x: number; y: number }; data: object; selected?: boolean }[];
    onNodesChange: (changes: unknown[]) => void;
    onNodeClick: (event: { currentTarget: HTMLElement }, node: (typeof nodes)[number]) => void;
    onConnect?: (connection: {
      source: string | null;
      target: string | null;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) => void;
    onEdgesDelete?: (edges: { id: string }[]) => void;
    onNodeDragStop?: (
      event: unknown,
      node: { id: string; position: { x: number; y: number } },
    ) => void;
    onMoveEnd?: (
      event: object | null,
      viewport: { x: number; y: number; zoom: number },
    ) => void;
    children: ReactNode;
  }) => {
    reactFlowHandlers.onMoveEnd = onMoveEnd;
    return (
      <>
      {nodes.map((node) => (
        <button
          key={`rendered-${node.id}`}
          type="button"
          className="react-flow__node"
          data-id={node.id}
          data-testid={`rendered-node-${node.id}`}
        >
          Nodo renderizado {node.id}
        </button>
      ))}
      {nodes.map((node) => (
        <output key={node.id} data-testid={`node-position-${node.id}`}>
          {`${node.position.x},${node.position.y}`}
        </output>
      ))}
      <output data-testid="selected-node">{nodes.find((node) => node.selected)?.id ?? ''}</output>
      <button
        type="button"
        onClick={() =>
          onNodesChange([{ id: 'node-1', type: 'position', position: { x: 207, y: 153 } }])
        }
      >
        Arrastrar nodo
      </button>
      <button
        type="button"
        onClick={() => onNodeDragStop?.(null, { id: 'node-1', position: { x: 27, y: 13 } })}
      >
        Finalizar arrastre
      </button>
      <button
        type="button"
        onClick={() => onMoveEnd?.({ type: 'pointerup' }, { x: 120, y: 80, zoom: 1.2 })}
      >
        Finalizar movimiento del viewport
      </button>
      <button
        type="button"
        onClick={() =>
          onConnect?.({
            source: 'node-1',
            target: 'node-2',
            sourceHandle: 'right',
            targetHandle: 'left',
          })
        }
      >
        Conectar dependencia
      </button>
      <button
        type="button"
        onClick={() =>
          onConnect?.({
            source: 'node-1',
            target: 'node-2',
            sourceHandle: null,
            targetHandle: null,
          })
        }
      >
        Conectar dependencia sin puntos
      </button>
      <button type="button" onClick={() => onConnect?.({ source: null, target: 'node-2' })}>
        Intentar conexión incompleta
      </button>
      <button
        type="button"
        onClick={() => onEdgesDelete?.([{ id: 'dependency-1' }, { id: 'dependency-2' }])}
      >
        Eliminar dependencias
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
            onNodesChange([{ id: 'node-1', type: 'position', position: { x: 27, y: 13 } }]);
        }}
      >
        Nodo con teclado
      </button>
      {nodes.map((node) => {
        const actionData = node.data as {
          canManageActions?: boolean;
          isActionMenuOpen?: boolean;
          onToggleActionMenu?: (nodeId: string, trigger: HTMLButtonElement) => void;
          onAction?: (intent: RoadmapGraphEditingIntent) => void;
          isTeacherBlocked?: boolean;
        };
        if (!actionData.canManageActions) return null;
        return (
          <div key={node.id}>
            <button
              type="button"
              aria-label={`${actionData.isActionMenuOpen ? 'Cerrar' : 'Abrir'} acciones ${node.id}`}
              onClick={(event) => actionData.onToggleActionMenu?.(node.id, event.currentTarget)}
            />
            {actionData.isActionMenuOpen ? (
              <button
                type="button"
                onClick={() =>
                  actionData.onAction?.({
                    kind: 'change-teacher-block',
                    nodeId: node.id,
                    operation: actionData.isTeacherBlocked ? 'UNBLOCK' : 'BLOCK',
                  })
                }
              >
                Ejecutar acceso {node.id}
              </button>
            ) : null}
          </div>
        );
      })}
      {children}
      </>
    );
  },
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
    screenToFlowPosition: screenToFlowPositionMock,
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    setViewport: setViewportMock,
  }),
}));

import {
  RoadmapGraph,
  type RoadmapGraphEditing,
  type RoadmapGraphEditingIntent,
} from '@/features/roadmap/graph/RoadmapGraph';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';

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

const studentRoadmap: StudentRoadmapDto = {
  ...roadmap,
  nodes: roadmap.nodes.map((node) => ({
    id: node.id,
    title: node.title,
    positionX: node.positionX,
    positionY: node.positionY,
    nodeTypeId: node.nodeTypeId,
    isVisible: true,
    access: { status: 'ACCESSIBLE' as const },
    description: node.description,
    isCompleted: false,
    canComplete: true,
    resources: [],
  })),
};

function editingCapability(overrides: Partial<RoadmapGraphEditing> = {}): RoadmapGraphEditing {
  return {
    onEditingIntent: vi.fn(),
    ...overrides,
  };
}

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
  const [editing] = useState(() => editingCapability());
  return (
    <div style={{ width: panelWidth }}>
      <RoadmapGraph
        projection={{ kind: 'teaching', roadmap: roadmapData, editing }}
        selectedNodeId={selectedNodeId}
        onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
      />
    </div>
  );
}

beforeEach(() => {
  fitViewMock.mockReset();
  screenToFlowPositionMock.mockReset();
  screenToFlowPositionMock.mockImplementation((position) => position);
  setViewportMock.mockReset();
  reactFlowHandlers.onMoveEnd = undefined;
});

test('renders a student projection without graph editing mechanics', () => {
  render(
    <RoadmapGraph
      projection={{ kind: 'student', roadmap: studentRoadmap }}
      onSelectNode={vi.fn()}
    />,
  );

  expect(screen.queryByRole('button', { name: 'Ordenar horizontalmente' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Abrir acciones node-1' })).toBeNull();
});

test('renders a teaching projection without editing when the capability is absent', () => {
  render(<RoadmapGraph projection={{ kind: 'teaching', roadmap }} onSelectNode={vi.fn()} />);

  expect(screen.queryByRole('button', { name: 'Ordenar horizontalmente' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Abrir acciones node-1' })).toBeNull();
});

test('keeps a dragged node position when selecting it before the roadmap reloads', async () => {
  const user = userEvent.setup();
  render(<GraphHarness />);

  await user.click(screen.getByRole('button', { name: 'Arrastrar nodo' }));
  expect(screen.getByTestId('node-position-node-1').textContent).toBe('200,160');

  await user.click(screen.getByRole('button', { name: 'Seleccionar nodo' }));
  expect(screen.getByTestId('node-position-node-1').textContent).toBe('200,160');
});

test('emits only the selected Node identifier through the Roadmap boundary', async () => {
  const user = userEvent.setup();
  const onSelectNode = vi.fn();
  render(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap, editing: editingCapability() }}
      onSelectNode={onSelectNode}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Seleccionar nodo' }));

  expect(onSelectNode).toHaveBeenCalledExactlyOnceWith('node-1');
});

test('restores focus to the selected rendered Node after an explicit focus-return request', async () => {
  const { rerender } = render(
    <>
      <button type="button">Fuera del canvas</button>
      <RoadmapGraph
        projection={{ kind: 'teaching', roadmap, editing: editingCapability() }}
        selectedNodeId="node-1"
        onSelectNode={vi.fn()}
      />
    </>,
  );
  const outside = screen.getByRole('button', { name: 'Fuera del canvas' });
  outside.focus();

  rerender(
    <>
      <button type="button">Fuera del canvas</button>
      <RoadmapGraph
        projection={{ kind: 'teaching', roadmap, editing: editingCapability() }}
        selectedNodeId={null}
        focusReturnRequest="close-node-1"
        onSelectNode={vi.fn()}
      />
    </>,
  );

  await waitFor(() =>
    expect(screen.getByTestId('rendered-node-node-1').matches(':focus')).toBe(true),
  );
});

test('does not move focus when the requested rendered Node no longer exists', async () => {
  const { rerender } = render(
    <>
      <button type="button">Fuera del canvas</button>
      <RoadmapGraph
        projection={{ kind: 'teaching', roadmap, editing: editingCapability() }}
        selectedNodeId="node-1"
        onSelectNode={vi.fn()}
      />
    </>,
  );
  const outside = screen.getByRole('button', { name: 'Fuera del canvas' });
  outside.focus();

  rerender(
    <>
      <button type="button">Fuera del canvas</button>
      <RoadmapGraph
        projection={{
          kind: 'teaching',
          roadmap: { ...roadmap, nodes: roadmap.nodes.filter((node) => node.id !== 'node-1') },
          editing: editingCapability(),
        }}
        selectedNodeId={null}
        focusReturnRequest="close-missing-node"
        onSelectNode={vi.fn()}
      />
    </>,
  );

  await waitFor(() => expect(outside.matches(':focus')).toBe(true));
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

test('reports only settled user viewport movement through the Roadmap boundary', async () => {
  const user = userEvent.setup();
  const onViewportChange = vi.fn();
  render(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap }}
      onSelectNode={vi.fn()}
      onViewportChange={onViewportChange}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Finalizar movimiento del viewport' }));

  expect(onViewportChange).toHaveBeenCalledExactlyOnceWith({ x: 120, y: 80, zoom: 1.2 });
});

test('applies each viewport restoration token once without reporting an echoed movement', async () => {
  const onViewportChange = vi.fn();
  const restoration = { token: 'preview-return-1', viewport: { x: 120, y: 80, zoom: 1.2 } };
  setViewportMock.mockImplementation((viewport) => reactFlowHandlers.onMoveEnd?.(null, viewport));
  const { rerender } = render(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap }}
      onSelectNode={vi.fn()}
      onViewportChange={onViewportChange}
      viewportRestoration={restoration}
    />,
  );

  await waitFor(() =>
    expect(setViewportMock).toHaveBeenCalledWith({ x: 120, y: 80, zoom: 1.2 }),
  );
  expect(onViewportChange).not.toHaveBeenCalled();

  rerender(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap }}
      onSelectNode={vi.fn()}
      onViewportChange={onViewportChange}
      viewportRestoration={{ token: 'preview-return-1', viewport: { x: 400, y: 0, zoom: 1 } }}
    />,
  );
  expect(setViewportMock).toHaveBeenCalledOnce();

  rerender(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap }}
      onSelectNode={vi.fn()}
      onViewportChange={onViewportChange}
      viewportRestoration={{ token: 'preview-return-2', viewport: { x: 400, y: 0, zoom: 1 } }}
    />,
  );
  await waitFor(() => expect(setViewportMock).toHaveBeenCalledTimes(2));
  expect(onViewportChange).not.toHaveBeenCalled();
});

test('centers the roadmap from the canvas control', async () => {
  const user = userEvent.setup();
  render(<GraphHarness />);

  await user.click(screen.getByRole('button', { name: 'Centrar mapa' }));

  expect(fitViewMock).toHaveBeenCalledWith({ padding: 0.28 });
});

test('offers toolbar content a snapped open position without exposing viewport geometry', async () => {
  const user = userEvent.setup();
  screenToFlowPositionMock.mockImplementation(({ x, y }) => ({ x: x + 7, y: y + 9 }));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 1_000,
    bottom: 1_000,
    width: 1_000,
    height: 1_000,
    toJSON: () => ({}),
  });
  const requests: unknown[] = [];
  try {
    render(
      <RoadmapGraph
        projection={{ kind: 'teaching', roadmap, editing: editingCapability() }}
        onSelectNode={vi.fn()}
        topRightActions={(findOpenPosition) => (
          <button type="button" onClick={() => requests.push(findOpenPosition('Nuevo hito'))}>
            Solicitar posición
          </button>
        )}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Solicitar posición' }));

    expect(requests).toEqual([{ x: 400, y: 460 }]);
  } finally {
    vi.restoreAllMocks();
  }
});

test('finds a grid-aligned gap when toolbar content requests an occupied position', async () => {
  const user = userEvent.setup();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 1_000,
    bottom: 1_000,
    width: 1_000,
    height: 1_000,
    toJSON: () => ({}),
  });
  const occupiedRoadmap = structuredClone(roadmap);
  occupiedRoadmap.nodes[0].positionX = 400;
  occupiedRoadmap.nodes[0].positionY = 460;
  let position: { x: number; y: number } | null = null;
  try {
    render(
      <RoadmapGraph
        projection={{ kind: 'teaching', roadmap: occupiedRoadmap, editing: editingCapability() }}
        onSelectNode={vi.fn()}
        topRightActions={(findOpenPosition) => (
          <button type="button" onClick={() => (position = findOpenPosition('Nuevo hito'))}>
            Solicitar posición libre
          </button>
        )}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Solicitar posición libre' }));

    expect(position).toEqual({ x: 400, y: 360 });
  } finally {
    vi.restoreAllMocks();
  }
});

test('reports no available position to toolbar content when the title cannot fit or occupancy fills the graph', async () => {
  const user = userEvent.setup();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 200,
    bottom: 100,
    width: 200,
    height: 100,
    toJSON: () => ({}),
  });
  const responses: unknown[] = [];
  try {
    const { rerender } = render(
      <RoadmapGraph
        projection={{ kind: 'teaching', roadmap: { ...roadmap, nodes: [] }, editing: editingCapability() }}
        onSelectNode={vi.fn()}
        topRightActions={(findOpenPosition) => (
          <button
            type="button"
            onClick={() => {
              responses.push(findOpenPosition('Corto'));
              responses.push(
                findOpenPosition(
                  'Un título deliberadamente muy largo que necesita varias líneas para leerse completo',
                ),
              );
            }}
          >
            Solicitar posiciones
          </button>
        )}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Solicitar posiciones' }));
    expect(responses).toEqual([{ x: 20, y: 20 }, null]);

    rerender(
      <RoadmapGraph
        projection={{ kind: 'teaching', roadmap, editing: editingCapability() }}
        onSelectNode={vi.fn()}
        topRightActions={(findOpenPosition) => (
          <button type="button" onClick={() => responses.push(findOpenPosition('Corto'))}>
            Solicitar posición ocupada
          </button>
        )}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Solicitar posición ocupada' }));

    expect(responses.at(-1)).toBeNull();
  } finally {
    vi.restoreAllMocks();
  }
});

test('closes the selected node when Escape is pressed on the canvas node', async () => {
  const user = userEvent.setup();
  const onClearSelectedNode = vi.fn();
  render(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap, editing: editingCapability() }}
      selectedNodeId="node-1"
      onSelectNode={vi.fn()}
      onClearSelectedNode={onClearSelectedNode}
    />,
  );

  screen.getByTestId('keyboard-node').focus();
  await user.keyboard('{Escape}');
  expect(onClearSelectedNode).toHaveBeenCalledOnce();
});

test('reports a keyboard node move for persistence', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  render(
    <RoadmapGraph
      projection={{
        kind: 'teaching',
        roadmap,
        editing: editingCapability({ onEditingIntent }),
      }}
      selectedNodeId="node-1"
      onSelectNode={vi.fn()}
    />,
  );

  screen.getByTestId('keyboard-node').focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByTestId('node-position-node-1').textContent).toBe('20,20');
  expect(onEditingIntent).toHaveBeenCalledWith({
    kind: 'node-positions',
    cause: 'keyboard',
    positions: [{ nodeId: 'node-1', position: { x: 20, y: 20 } }],
  });
});

test('emits the snapped pointer position supplied by React Flow', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  render(
    <RoadmapGraph
      projection={{
        kind: 'teaching',
        roadmap,
        editing: editingCapability({ onEditingIntent }),
      }}
      onSelectNode={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Finalizar arrastre' }));
  expect(screen.getByTestId('node-position-node-1').textContent).toBe('20,20');

  expect(onEditingIntent).toHaveBeenCalledWith({
    kind: 'node-positions',
    cause: 'pointer',
    positions: [{ nodeId: 'node-1', position: { x: 20, y: 20 } }],
  });
});

test('keeps one action menu open, closes it with Escape, and emits a teacher-block intent', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  render(
    <RoadmapGraph
      projection={{
        kind: 'teaching',
        roadmap,
        editing: editingCapability({ onEditingIntent }),
      }}
      onSelectNode={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Abrir acciones node-1' }));
  expect(screen.queryByRole('button', { name: 'Cerrar menú de acciones del nodo' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Ejecutar acceso node-1' })).toBeTruthy();

  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Ejecutar acceso node-1' })).toBeNull(),
  );

  await user.click(screen.getByRole('button', { name: 'Abrir acciones node-1' }));
  await user.click(screen.getByRole('button', { name: 'Ejecutar acceso node-1' }));
  expect(onEditingIntent).toHaveBeenCalledWith({
    kind: 'change-teacher-block',
    nodeId: 'node-1',
    operation: 'BLOCK',
  });
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Cerrar menú de acciones del nodo' })).toBeNull(),
  );
});

test('clears action-menu state when editing behavior is removed', async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap, editing: editingCapability() }}
      onSelectNode={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Abrir acciones node-1' }));
  expect(screen.getByRole('button', { name: 'Ejecutar acceso node-1' })).toBeTruthy();

  rerender(<RoadmapGraph projection={{ kind: 'teaching', roadmap }} onSelectNode={vi.fn()} />);
  rerender(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap, editing: editingCapability() }}
      onSelectNode={vi.fn()}
    />,
  );

  expect(screen.queryByRole('button', { name: 'Ejecutar acceso node-1' })).toBeNull();
});

test('proposes automatic ordering without moving Nodes until confirmation', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  render(
    <RoadmapGraph
      projection={{
        kind: 'teaching',
        roadmap,
        editing: editingCapability({ onEditingIntent }),
      }}
      onSelectNode={vi.fn()}
    />,
  );

  const layoutButton = screen.getByRole('button', { name: 'Ordenar horizontalmente' });
  expect(screen.getByTestId('node-position-node-1').textContent).toBe('0,0');
  expect(screen.getByTestId('node-position-node-2').textContent).toBe('300,180');
  await user.click(layoutButton);

  const dialog = screen.getByRole('alertdialog', { name: 'Confirmar ordenamiento' });
  expect(
    within(dialog).getByText(
      'El ordenamiento automático reubicará los nodos del lienzo. ¿Deseas continuar?',
    ),
  ).toBeTruthy();
  expect(onEditingIntent).not.toHaveBeenCalled();

  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(onEditingIntent).not.toHaveBeenCalled();
  expect(screen.getByTestId('node-position-node-1').textContent).toBe('0,0');
  expect(screen.getByTestId('node-position-node-2').textContent).toBe('300,180');
  await user.keyboard('{Enter}');
  expect(screen.getByRole('alertdialog', { name: 'Confirmar ordenamiento' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));

  await user.click(layoutButton);
  await user.click(
    within(screen.getByRole('alertdialog', { name: 'Confirmar ordenamiento' })).getByRole(
      'button',
      { name: 'Ordenar nodos' },
    ),
  );

  expect(onEditingIntent).toHaveBeenCalledOnce();
  const [intent] = onEditingIntent.mock.calls[0] as [RoadmapGraphEditingIntent];
  expect(intent.kind).toBe('node-positions');
  if (intent.kind !== 'node-positions') return;
  expect(intent.cause).toBe('automatic-layout');
  expect(intent.positions.map(({ nodeId }) => nodeId)).toEqual(['node-1', 'node-2']);
  expect(Object.isFrozen(intent.positions)).toBe(true);
  expect(Object.isFrozen(intent.positions[0])).toBe(true);
  expect(Object.isFrozen(intent.positions[0].position)).toBe(true);
  for (const { nodeId, position } of intent.positions)
    expect(screen.getByTestId(`node-position-${nodeId}`).textContent).toBe(
      `${position.x},${position.y}`,
    );
});

test('dismisses an automatic-layout proposal when a newer Roadmap projection arrives', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  const { rerender } = render(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap, editing: editingCapability({ onEditingIntent }) }}
      onSelectNode={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Ordenar horizontalmente' }));
  expect(screen.getByRole('alertdialog', { name: 'Confirmar ordenamiento' })).toBeTruthy();

  const refreshedRoadmap = structuredClone(roadmap);
  refreshedRoadmap.nodes[0].positionX = 40;
  refreshedRoadmap.nodes[0].positionY = 60;
  rerender(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap: refreshedRoadmap, editing: editingCapability({ onEditingIntent }) }}
      onSelectNode={vi.fn()}
    />,
  );

  expect(screen.queryByRole('alertdialog', { name: 'Confirmar ordenamiento' })).toBeNull();
  expect(screen.getByTestId('node-position-node-1').textContent).toBe('40,60');
  expect(onEditingIntent).not.toHaveBeenCalled();
});

test('emits complete dependency intents and ignores incomplete connection gestures', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  render(
    <RoadmapGraph
      projection={{
        kind: 'teaching',
        roadmap,
        editing: editingCapability({ onEditingIntent }),
      }}
      onSelectNode={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Conectar dependencia' }));
  expect(onEditingIntent).toHaveBeenCalledWith({
    kind: 'create-dependency',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    sourceHandle: 'right',
    targetHandle: 'left',
  });

  onEditingIntent.mockClear();
  await user.click(screen.getByRole('button', { name: 'Conectar dependencia sin puntos' }));
  expect(onEditingIntent).toHaveBeenCalledWith({
    kind: 'create-dependency',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    sourceHandle: 'right',
    targetHandle: 'left',
  });

  onEditingIntent.mockClear();
  await user.click(screen.getByRole('button', { name: 'Intentar conexión incompleta' }));
  expect(onEditingIntent).not.toHaveBeenCalled();
});

test('emits an immutable collection when deleting Dependencies', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  render(
    <RoadmapGraph
      projection={{
        kind: 'teaching',
        roadmap,
        editing: editingCapability({ onEditingIntent }),
      }}
      onSelectNode={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Eliminar dependencias' }));

  const [intent] = onEditingIntent.mock.calls[0] as [RoadmapGraphEditingIntent];
  expect(intent).toEqual({
    kind: 'delete-dependencies',
    dependencyIds: ['dependency-1', 'dependency-2'],
  });
  expect(intent.kind === 'delete-dependencies' && Object.isFrozen(intent.dependencyIds)).toBe(true);
});

test('does not expose automatic ordering when the Roadmap cannot be edited', () => {
  render(<RoadmapGraph projection={{ kind: 'teaching', roadmap }} onSelectNode={vi.fn()} />);

  expect(screen.queryByRole('button', { name: 'Ordenar horizontalmente' })).toBeNull();
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('places each roadmap overlay slot in its constrained viewport panel', () => {
  render(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap }}
      onSelectNode={vi.fn()}
      overlaySlots={{
        topLeft: <span data-testid="top-left-overlay">Metadata</span>,
        topCenter: <span data-testid="top-center-overlay">Preview</span>,
        bottomRight: <span data-testid="bottom-right-overlay">Feedback</span>,
      }}
    />,
  );

  expect(
    within(screen.getByTestId('roadmap-panel-top-left')).getByTestId('top-left-overlay'),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('roadmap-panel-top-center')).getByTestId('top-center-overlay'),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('roadmap-panel-bottom-right')).getByTestId('bottom-right-overlay'),
  ).toBeTruthy();
});

test('disables automatic ordering until the Roadmap has enough Nodes', async () => {
  const user = userEvent.setup();
  render(
    <RoadmapGraph
      projection={{
        kind: 'teaching',
        roadmap: { ...roadmap, nodes: roadmap.nodes.slice(0, 1) },
        editing: editingCapability(),
      }}
      onSelectNode={vi.fn()}
    />,
  );

  const button = screen.getByRole('button', {
    name: 'Ordenar horizontalmente',
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);

  await user.click(button);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
