import { useState, type ReactNode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mockViewport } from '../../../support/viewport';

const {
  fitViewMock,
  screenToFlowPositionMock,
  setViewportMock,
  getInternalNodeMock,
  updateNodeInternalsMock,
  reactFlowHandlers,
} = vi.hoisted(() => ({
  fitViewMock: vi.fn(),
  screenToFlowPositionMock: vi.fn<
    (
      position: { x: number; y: number },
      options?: { snapToGrid?: boolean },
    ) => { x: number; y: number }
  >((position) => position),
  setViewportMock: vi.fn(),
  getInternalNodeMock: vi.fn<(id: string) => { internals: { handleBounds?: object } }>(),
  updateNodeInternalsMock: vi.fn<(ids: string[]) => void>(),
  reactFlowHandlers: {
    onMoveEnd: undefined as
      | ((event: object | null, viewport: { x: number; y: number; zoom: number }) => void)
      | undefined,
  },
}));

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  ConnectionMode: { Loose: 'loose' },
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
    nodes: {
      id: string;
      position: { x: number; y: number };
      data: object;
      selected?: boolean;
      measured?: { width?: number; height?: number };
    }[];
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
    onMoveEnd?: (event: object | null, viewport: { x: number; y: number; zoom: number }) => void;
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
        {nodes.map((node) => (
          <output key={node.id} data-testid={`node-measured-${node.id}`}>
            {node.measured ? `${node.measured.width}x${node.measured.height}` : ''}
          </output>
        ))}
        <output data-testid="selected-node">{nodes.find((node) => node.selected)?.id ?? ''}</output>
        <button
          type="button"
          onClick={() =>
            onNodesChange(
              nodes.map((node) => ({
                id: node.id,
                type: 'dimensions',
                dimensions: { width: 180, height: 80 },
              })),
            )
          }
        >
          Medir nodos
        </button>
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
        <button
          type="button"
          onClick={() => onNodeClick({ currentTarget: document.body }, nodes[0])}
        >
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
    changes: {
      id: string;
      type: string;
      position?: { x: number; y: number };
      dimensions?: { width: number; height: number };
    }[],
    nodes: T[],
  ) =>
    nodes.map((node) => {
      const change = changes.find((candidate) => candidate.id === node.id);
      if (change?.position) return { ...node, position: change.position };
      if (change?.dimensions) return { ...node, measured: change.dimensions };
      return node;
    }),
  useReactFlow: () => ({
    fitView: fitViewMock,
    screenToFlowPosition: screenToFlowPositionMock,
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    setViewport: setViewportMock,
    getInternalNode: getInternalNodeMock,
  }),
  useUpdateNodeInternals: () => updateNodeInternalsMock,
}));

import {
  RoadmapGraph,
  type RoadmapGraphEditing,
  type RoadmapGraphEditingIntent,
  type RoadmapGraphProps,
} from '@/features/roadmap/graph/RoadmapGraph';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import type { CanvasCommandOf } from '@/features/roadmap/canvas/commands/commands';

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

type GraphOptions = Omit<Partial<RoadmapGraphProps>, 'projection'> & {
  roadmap?: RoadmapDto;
  editing?: Partial<RoadmapGraphEditing>;
};

function graph({ roadmap: roadmapData = roadmap, editing, ...props }: GraphOptions = {}) {
  return (
    <RoadmapGraph
      projection={{
        kind: 'teaching',
        roadmap: roadmapData,
        ...(editing ? { editing: editingCapability(editing) } : {}),
      }}
      onSelectNode={vi.fn()}
      {...props}
    />
  );
}

function renderGraph(options?: GraphOptions) {
  const utils = render(graph(options));
  return { ...utils, rerenderGraph: (next?: GraphOptions) => utils.rerender(graph(next)) };
}

function withOutsideButton(content: ReactNode) {
  return (
    <>
      <button type="button">Fuera del canvas</button>
      {content}
    </>
  );
}

function mockCanvasRect(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  });
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
  fitViewMock.mockResolvedValue(true);
  screenToFlowPositionMock.mockReset();
  screenToFlowPositionMock.mockImplementation((position) => position);
  setViewportMock.mockReset();
  getInternalNodeMock.mockReset();
  getInternalNodeMock.mockReturnValue({ internals: { handleBounds: {} } });
  updateNodeInternalsMock.mockReset();
  reactFlowHandlers.onMoveEnd = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

test.each([
  {
    name: 'renders a student projection without graph editing mechanics',
    element: () => (
      <RoadmapGraph
        projection={{ kind: 'student', roadmap: studentRoadmap }}
        onSelectNode={vi.fn()}
      />
    ),
  },
  {
    name: 'renders a teaching projection without editing when the capability is absent',
    element: () => graph(),
  },
])('$name', ({ element }) => {
  render(element());

  expect(screen.queryByRole('button', { name: 'Ordenar horizontalmente' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Abrir acciones node-1' })).toBeNull();
  expect(screen.queryByRole('alertdialog')).toBeNull();
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
  renderGraph({ editing: {}, onSelectNode });

  await user.click(screen.getByRole('button', { name: 'Seleccionar nodo' }));

  expect(onSelectNode).toHaveBeenCalledExactlyOnceWith('node-1');
});

test('restores focus to the selected rendered Node after an explicit focus-return request', async () => {
  const { rerender } = render(withOutsideButton(graph({ editing: {}, selectedNodeId: 'node-1' })));
  const outside = screen.getByRole('button', { name: 'Fuera del canvas' });
  outside.focus();

  rerender(
    withOutsideButton(
      graph({ editing: {}, selectedNodeId: null, focusReturnRequest: 'close-node-1' }),
    ),
  );

  await waitFor(() =>
    expect(screen.getByTestId('rendered-node-node-1').matches(':focus')).toBe(true),
  );
});

test('does not move focus when the requested rendered Node no longer exists', async () => {
  const { rerender } = render(withOutsideButton(graph({ editing: {}, selectedNodeId: 'node-1' })));
  const outside = screen.getByRole('button', { name: 'Fuera del canvas' });
  outside.focus();

  rerender(
    withOutsideButton(
      graph({
        roadmap: { ...roadmap, nodes: roadmap.nodes.filter((node) => node.id !== 'node-1') },
        editing: {},
        selectedNodeId: null,
        focusReturnRequest: 'close-missing-node',
      }),
    ),
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

test('keeps the dimensions React Flow measured when refreshed roadmap data arrives', async () => {
  const user = userEvent.setup();
  const updatedRoadmap = structuredClone(roadmap);
  updatedRoadmap.nodes[1].isTeacherBlocked = true;
  const { rerender } = render(<GraphHarness />);
  await user.click(screen.getByRole('button', { name: 'Medir nodos' }));
  expect(screen.getByTestId('node-measured-node-1').textContent).toBe('180x80');

  rerender(<GraphHarness roadmapData={updatedRoadmap} />);

  // React Flow hides a Node without dimensions and does not always measure it again.
  expect(screen.getByTestId('node-measured-node-1').textContent).toBe('180x80');
  expect(screen.getByTestId('node-measured-node-2').textContent).toBe('180x80');
});

test('asks React Flow to measure again a shown Node it left without handle bounds', () => {
  getInternalNodeMock.mockImplementation((id) =>
    id === 'node-1' ? { internals: {} } : { internals: { handleBounds: {} } },
  );

  renderGraph();

  expect(updateNodeInternalsMock).toHaveBeenLastCalledWith(['node-1']);
});

test('leaves measured Nodes and student-hidden Nodes to React Flow', () => {
  const hiddenNodeRoadmap: StudentRoadmapDto = {
    ...studentRoadmap,
    // The student DTO type never carries a hidden Node; the graph still hides one defensively.
    nodes: studentRoadmap.nodes.map((node) =>
      node.id === 'node-2' ? ({ ...node, isVisible: false } as unknown as typeof node) : node,
    ),
  };
  getInternalNodeMock.mockImplementation((id) =>
    id === 'node-2' ? { internals: {} } : { internals: { handleBounds: {} } },
  );

  render(
    <RoadmapGraph
      projection={{ kind: 'student', roadmap: hiddenNodeRoadmap }}
      onSelectNode={vi.fn()}
    />,
  );

  expect(updateNodeInternalsMock).not.toHaveBeenCalled();
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
  renderGraph({ onViewportChange });

  await user.click(screen.getByRole('button', { name: 'Finalizar movimiento del viewport' }));

  expect(onViewportChange).toHaveBeenCalledExactlyOnceWith({ x: 120, y: 80, zoom: 1.2 });
});

test('applies each viewport restoration token once without reporting an echoed movement', async () => {
  const onViewportChange = vi.fn();
  const restoration = { token: 'preview-return-1', viewport: { x: 120, y: 80, zoom: 1.2 } };
  setViewportMock.mockImplementation((viewport) => reactFlowHandlers.onMoveEnd?.(null, viewport));
  const { rerenderGraph } = renderGraph({ onViewportChange, viewportRestoration: restoration });

  await waitFor(() => expect(setViewportMock).toHaveBeenCalledWith({ x: 120, y: 80, zoom: 1.2 }));
  expect(onViewportChange).not.toHaveBeenCalled();

  rerenderGraph({
    onViewportChange,
    viewportRestoration: { token: 'preview-return-1', viewport: { x: 400, y: 0, zoom: 1 } },
  });
  expect(setViewportMock).toHaveBeenCalledOnce();

  rerenderGraph({
    onViewportChange,
    viewportRestoration: { token: 'preview-return-2', viewport: { x: 400, y: 0, zoom: 1 } },
  });
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
  mockCanvasRect(1_000, 1_000);
  const requests: unknown[] = [];
  renderGraph({
    editing: {},
    bottomLeftActions: (findOpenPosition) => (
      <button type="button" onClick={() => requests.push(findOpenPosition('Nuevo hito'))}>
        Solicitar posición
      </button>
    ),
  });

  await user.click(screen.getByRole('button', { name: 'Solicitar posición' }));

  expect(requests).toEqual([{ x: 420, y: 460 }]);
});

test.each([
  { width: 139, expected: { x: 0, y: 0 } },
  { width: 119, expected: null },
])('keeps new cards inside the unsnapped viewport at width $width', async ({ width, expected }) => {
  const user = userEvent.setup();
  mockCanvasRect(width, 99);
  screenToFlowPositionMock.mockImplementation(({ x, y }, options) => {
    const position = { x: x - 7, y: y - 9 };
    return options?.snapToGrid === false
      ? position
      : {
          x: Math.round(position.x / 20) * 20,
          y: Math.round(position.y / 20) * 20,
        };
  });
  const responses: unknown[] = [];
  renderGraph({
    roadmap: { ...roadmap, nodes: [] },
    editing: {},
    bottomLeftActions: (findOpenPosition) => (
      <button type="button" onClick={() => responses.push(findOpenPosition('Corto'))}>
        Solicitar posición en viewport desplazado
      </button>
    ),
  });

  await user.click(
    screen.getByRole('button', { name: 'Solicitar posición en viewport desplazado' }),
  );

  expect(responses).toEqual([expected]);
});

test('finds a grid-aligned gap when toolbar content requests an occupied position', async () => {
  const user = userEvent.setup();
  mockCanvasRect(1_000, 1_000);
  const occupiedRoadmap = structuredClone(roadmap);
  occupiedRoadmap.nodes[0].positionX = 400;
  occupiedRoadmap.nodes[0].positionY = 460;
  let position: { x: number; y: number } | null = null;
  renderGraph({
    roadmap: occupiedRoadmap,
    editing: {},
    bottomLeftActions: (findOpenPosition) => (
      <button type="button" onClick={() => (position = findOpenPosition('Nuevo hito'))}>
        Solicitar posición libre
      </button>
    ),
  });

  await user.click(screen.getByRole('button', { name: 'Solicitar posición libre' }));

  expect(position).toEqual({ x: 420, y: 360 });
});

test('reports no available position to toolbar content when the title cannot fit or occupancy fills the graph', async () => {
  const user = userEvent.setup();
  mockCanvasRect(200, 100);
  const responses: unknown[] = [];
  const { rerenderGraph } = renderGraph({
    roadmap: { ...roadmap, nodes: [] },
    editing: {},
    bottomLeftActions: (findOpenPosition) => (
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
    ),
  });

  await user.click(screen.getByRole('button', { name: 'Solicitar posiciones' }));
  expect(responses).toEqual([{ x: 40, y: 20 }, null]);

  rerenderGraph({
    editing: {},
    bottomLeftActions: (findOpenPosition) => (
      <button type="button" onClick={() => responses.push(findOpenPosition('Corto'))}>
        Solicitar posición ocupada
      </button>
    ),
  });
  await user.click(screen.getByRole('button', { name: 'Solicitar posición ocupada' }));

  expect(responses.at(-1)).toBeNull();
});

test('closes the selected node when Escape is pressed on the canvas node', async () => {
  const user = userEvent.setup();
  const onClearSelectedNode = vi.fn();
  renderGraph({ editing: {}, selectedNodeId: 'node-1', onClearSelectedNode });

  screen.getByTestId('keyboard-node').focus();
  await user.keyboard('{Escape}');
  expect(onClearSelectedNode).toHaveBeenCalledOnce();
});

test.each([
  {
    name: 'reports a keyboard node move for persistence',
    selectedNodeId: 'node-1',
    move: async (user: ReturnType<typeof userEvent.setup>) => {
      screen.getByTestId('keyboard-node').focus();
      await user.keyboard('{ArrowRight}');
    },
  },
  {
    name: 'emits the snapped pointer position supplied by React Flow',
    selectedNodeId: undefined,
    move: (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole('button', { name: 'Finalizar arrastre' })),
  },
])('$name', async ({ selectedNodeId, move }) => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  renderGraph({ editing: { onEditingIntent }, selectedNodeId });

  await move(user);
  expect(screen.getByTestId('node-position-node-1').textContent).toBe('20,20');
  expect(onEditingIntent).toHaveBeenCalledWith({
    kind: 'move-nodes',
    positions: [{ nodeId: 'node-1', position: { x: 20, y: 20 } }],
  });
});

test('keeps one action menu open, closes it with Escape, and emits a teacher-block intent', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  renderGraph({ editing: { onEditingIntent } });

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
  const { rerenderGraph } = renderGraph({ editing: {} });

  await user.click(screen.getByRole('button', { name: 'Abrir acciones node-1' }));
  expect(screen.getByRole('button', { name: 'Ejecutar acceso node-1' })).toBeTruthy();

  rerenderGraph();
  rerenderGraph({ editing: {} });

  expect(screen.queryByRole('button', { name: 'Ejecutar acceso node-1' })).toBeNull();
});

test('translates automatic-layout geometry into an automatic-layout command without moving Nodes', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  renderGraph({ editing: { onEditingIntent } });

  const layoutButton = screen.getByRole('button', { name: 'Ordenar horizontalmente' });
  expect(screen.getByTestId('node-position-node-1').textContent).toBe('0,0');
  expect(screen.getByTestId('node-position-node-2').textContent).toBe('300,180');
  await user.click(layoutButton);

  expect(onEditingIntent).toHaveBeenCalledOnce();
  const [intent] = onEditingIntent.mock.calls[0] as [RoadmapGraphEditingIntent];
  expect(intent.kind).toBe('apply-automatic-layout');
  if (intent.kind !== 'apply-automatic-layout') return;
  expect(intent.positions.map(({ nodeId }) => nodeId)).toEqual(['node-1', 'node-2']);
  expect(Object.isFrozen(intent.positions)).toBe(true);
  expect(Object.isFrozen(intent.positions[0])).toBe(true);
  expect(Object.isFrozen(intent.positions[0].position)).toBe(true);
  expect(screen.getByTestId('node-position-node-1').textContent).toBe('0,0');
  expect(screen.getByTestId('node-position-node-2').textContent).toBe('300,180');
});

test('emits no automatic-layout command when every Node already sits where the layout puts it', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  const { rerenderGraph } = renderGraph({ editing: { onEditingIntent } });
  await user.click(screen.getByRole('button', { name: 'Ordenar horizontalmente' }));
  const [layout] = onEditingIntent.mock.calls[0] as [CanvasCommandOf<'apply-automatic-layout'>];
  const laidOut: RoadmapDto = {
    ...roadmap,
    nodes: roadmap.nodes.map((node) => {
      const placement = layout.positions.find(({ nodeId }) => nodeId === node.id);
      return placement
        ? { ...node, positionX: placement.position.x, positionY: placement.position.y }
        : node;
    }),
  };
  onEditingIntent.mockClear();

  rerenderGraph({ roadmap: laidOut, editing: { onEditingIntent } });
  await user.click(screen.getByRole('button', { name: 'Ordenar horizontalmente' }));

  expect(onEditingIntent).not.toHaveBeenCalled();
});

test('emits a fresh automatic-layout request for each gesture', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  renderGraph({ editing: { onEditingIntent } });

  await user.click(screen.getByRole('button', { name: 'Ordenar horizontalmente' }));
  await user.click(screen.getByRole('button', { name: 'Ordenar horizontalmente' }));
  expect(onEditingIntent).toHaveBeenCalledTimes(2);
  expect(
    onEditingIntent.mock.calls.every(([intent]) => intent.kind === 'apply-automatic-layout'),
  ).toBe(true);
});

test('emits complete dependency intents and ignores incomplete connection gestures', async () => {
  const user = userEvent.setup();
  const onEditingIntent = vi.fn();
  renderGraph({ editing: { onEditingIntent } });

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
  renderGraph({ editing: { onEditingIntent } });

  await user.click(screen.getByRole('button', { name: 'Eliminar dependencias' }));

  const [intent] = onEditingIntent.mock.calls[0] as [RoadmapGraphEditingIntent];
  expect(intent).toEqual({
    kind: 'delete-dependencies',
    dependencyIds: ['dependency-1', 'dependency-2'],
  });
  expect(intent.kind === 'delete-dependencies' && Object.isFrozen(intent.dependencyIds)).toBe(true);
});

test('places each roadmap overlay slot in its constrained viewport panel', () => {
  renderGraph({
    overlaySlots: {
      topLeft: <span data-testid="top-left-overlay">Metadata</span>,
      topCenter: <span data-testid="top-center-overlay">Preview</span>,
      bottomRight: <span data-testid="bottom-right-overlay">Feedback</span>,
    },
  });

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
  renderGraph({ roadmap: { ...roadmap, nodes: roadmap.nodes.slice(0, 1) }, editing: {} });

  const button = screen.getByRole('button', {
    name: 'Ordenar horizontalmente',
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);

  await user.click(button);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

beforeEach(() => mockViewport(1280));
afterEach(() => vi.unstubAllGlobals());
