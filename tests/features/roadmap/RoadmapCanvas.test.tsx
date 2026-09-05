import { type ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { RoadmapCanvas } from '@/features/roadmap';

const { useRoadmapMock } = vi.hoisted(() => ({ useRoadmapMock: vi.fn() }));

vi.mock('next/dynamic', () => ({
  default:
    () =>
    ({
      selectedNode,
      isOpen,
      onToggle,
      onClose,
      onPreview,
      onRequestTeacherBlock,
      onToggleVisibility,
      onUpdateNode,
      onAddResource,
    }: {
      selectedNode?: { id: string; isTeacherBlocked: boolean };
      isOpen: boolean;
      onToggle: () => void;
      onClose: () => void;
      onPreview: (node: {
        id: string;
        title: string;
        description: string | null;
        nodeTypeId: string;
        positionX: number;
        positionY: number;
        isVisible: true;
        access: { status: 'ACCESSIBLE' };
        isCompleted: boolean;
        canComplete: boolean;
        resources: [];
      }) => void;
      onRequestTeacherBlock: (nodeId: string, operation: 'BLOCK' | 'UNBLOCK') => void;
      onToggleVisibility: (nodeId: string, isVisible: boolean) => void;
      onUpdateNode: (nodeId: string, node: unknown) => Promise<boolean>;
      onAddResource: (nodeId: string, resource: unknown) => Promise<boolean>;
    }) =>
      isOpen ? (
        <aside data-testid="editor-panel">
          <button type="button" onClick={onToggle}>
            Ocultar panel de edición
          </button>
          {selectedNode ? (
            <>
              <button type="button" onClick={onClose}>
                Deseleccionar nodo
              </button>
              <button type="button" onClick={() => onRequestTeacherBlock(selectedNode.id, 'BLOCK')}>
                Bloquear acceso
              </button>
              <button type="button" onClick={() => onToggleVisibility(selectedNode.id, true)}>
                Ocultar para estudiantes
              </button>
              <button
                type="button"
                onClick={() => void onUpdateNode(selectedNode.id, { title: 'Límites' })}
              >
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={() =>
                  void onAddResource(selectedNode.id, {
                    title: 'Guía de ejercicios',
                    url: 'https://example.test/guia',
                    type: 'LINK',
                  })
                }
              >
                Guardar enlace
              </button>
              <button
                type="button"
                onClick={() =>
                  onPreview({
                    id: selectedNode.id,
                    title: 'Vista previa docente',
                    description: 'Borrador visible',
                    nodeTypeId: 'content',
                    positionX: 0,
                    positionY: 0,
                    isVisible: true,
                    access: { status: 'ACCESSIBLE' },
                    isCompleted: false,
                    canComplete: true,
                    resources: [],
                  })
                }
              >
                Previsualizar
              </button>
            </>
          ) : null}
        </aside>
      ) : null,
}));

vi.mock('@/features/roadmap/graph/RoadmapGraph', () => ({
  RoadmapGraph: ({
    onSelectNode,
    onConnectNodes,
    onDeleteDependencies,
    onAutoLayout,
    onClearSelectedNode,
    onKeyboardNodeMove,
    selectedNodeId,
    topRightActions,
  }: {
    onSelectNode: (nodeId: string, trigger: HTMLElement) => void;
    onConnectNodes: (connection: {
      source: string | null;
      target: string | null;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) => void;
    onDeleteDependencies: (ids: string[]) => void;
    onAutoLayout: (nodes: { id: string; position: { x: number; y: number } }[]) => void;
    onClearSelectedNode?: () => void;
    onKeyboardNodeMove?: (nodeId: string, position: { x: number; y: number }) => void;
    selectedNodeId?: string | null;
    topRightActions?: (
      getViewport: () => {
        x: number;
        y: number;
        width: number;
        height: number;
      },
    ) => ReactNode;
  }) => (
    <>
      {topRightActions?.(() => ({ x: 0, y: 0, width: 800, height: 600 }))}
      <output data-testid="selected-roadmap-node">{selectedNodeId}</output>
      <button
        type="button"
        onClick={() => onSelectNode('blocked-node', document.createElement('div'))}
      >
        Activar nodo bloqueado
      </button>
      <button type="button" onClick={() => onSelectNode('node-1', document.createElement('div'))}>
        Activar nodo docente
      </button>
      <button
        type="button"
        onClick={() => onSelectNode('missing-node', document.createElement('div'))}
      >
        Activar nodo inexistente
      </button>
      <button type="button" onClick={() => onDeleteDependencies(['dependency-1', 'dependency-2'])}>
        Solicitar eliminación de dependencias
      </button>
      <button
        type="button"
        onClick={() =>
          onConnectNodes({
            source: 'source-node',
            target: 'target-node',
            sourceHandle: 'right',
            targetHandle: 'left',
          })
        }
      >
        Conectar rama bloqueada
      </button>
      <button
        type="button"
        onClick={() => onAutoLayout([{ id: 'node-1', position: { x: 40, y: 80 } }])}
      >
        Ordenar mapa
      </button>
      <button type="button" onClick={onClearSelectedNode}>
        Cerrar nodo con Escape
      </button>
      <button type="button" onClick={() => onKeyboardNodeMove?.('node-1', { x: 20, y: 0 })}>
        Mover nodo con teclado
      </button>
    </>
  ),
}));

vi.mock('@/features/roadmap/student/NodeDetail', () => ({
  StudentNodeDetail: ({
    node,
    status,
    onClose,
    onComplete,
  }: {
    node?: { title: string };
    status: string | null;
    onClose: () => void;
    onComplete: (node: { title: string }) => void;
  }) =>
    node ? (
      <aside data-testid="student-detail">
        <p>{node.title}</p>
        <p>{status}</p>
        <button type="button" onClick={() => onComplete(node)}>
          Completar
        </button>
        <button type="button" onClick={onClose}>
          Cerrar detalle
        </button>
      </aside>
    ) : null,
}));

vi.mock('@/features/roadmap/useRoadmap', () => ({ useRoadmap: useRoadmapMock }));

const roadmap = {
  course: { code: 'CC1001', name: 'Programación I', department: 'DCC' },
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
      nodeTypeId: 'content',
      positionX: 0,
      positionY: 0,
      isVisible: true,
      isTeacherBlocked: false,
      resources: [],
    },
  ],
  dependencies: [],
};

const identifier = { courseCode: 'CC1001', year: 2026, semester: 2 };

function roadmapActions(overrides = {}) {
  return {
    roadmap,
    error: null,
    dismissError: vi.fn(),
    addNode: vi.fn(),
    updateNode: vi.fn(),
    moveNode: vi.fn(),
    connectNodes: vi.fn(),
    previewRoadmapDependency: vi.fn().mockResolvedValue([]),
    previewTeacherBlock: vi.fn().mockResolvedValue([]),
    changeTeacherBlock: vi.fn(),
    deleteDependency: vi.fn(),
    toggleVisibility: vi.fn(),
    previewNodeVisibility: vi.fn().mockResolvedValue([]),
    deleteNode: vi.fn(),
    addResource: vi.fn(),
    updateResource: vi.fn(),
    deleteResource: vi.fn(),
    addNodeType: vi.fn(),
    updateNodeType: vi.fn(),
    deleteNodeType: vi.fn(),
    completeNode: vi.fn(),
    ...overrides,
  };
}

function renderCanvas(canEdit = false) {
  return render(
    <RoadmapCanvas
      identifier={identifier}
      canEdit={canEdit}
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={2}
    />,
  );
}

test('announces the loading state and renders a named error when the roadmap cannot load', () => {
  useRoadmapMock.mockReturnValue(roadmapActions({ roadmap: null }));
  const { rerender } = renderCanvas();

  expect(screen.getByRole('status', { name: 'Cargando roadmap' })).toBeTruthy();
  expect(screen.getByText('Cargando roadmap...')).toBeTruthy();

  useRoadmapMock.mockReturnValue(
    roadmapActions({ roadmap: null, error: 'No se pudo cargar el roadmap.' }),
  );
  rerender(
    <RoadmapCanvas
      identifier={identifier}
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={2}
    />,
  );

  expect(screen.getByRole('alert').textContent).toBe(
    'Error al cargar el roadmapNo se pudo cargar el roadmap.',
  );
});

test('shows the course code and localized term together in the canvas header', () => {
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  expect(screen.getByRole('heading', { name: 'Programación I' })).toBeTruthy();
  const courseCode = screen.getByText('CC1001');
  expect(courseCode.parentElement?.textContent).toBe('CC1001·Primavera 2026');
  expect(screen.getByText('Primavera 2026')).toBeTruthy();
  expect(screen.getByText('Modo edición')).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Leyenda del roadmap' })).toBeNull();
  const shortcuts = screen.getByRole('group', { name: 'Atajos de teclado' });
  expect(shortcuts).toHaveProperty('open', false);
  expect(within(shortcuts).getByText('Ocultar o mostrar el panel lateral.')).toBeTruthy();
  expect(within(shortcuts).getByText(/Mover el nodo seleccionado en modo edición/)).toBeTruthy();
  const canvas = screen.getByLabelText('Lienzo del roadmap');
  expect(canvas.className).toContain('lg:min-h-0');
  expect(canvas.parentElement?.className).toContain('lg:grid-rows-[minmax(0,1fr)]');
  expect(canvas.parentElement?.parentElement?.className).toContain('lg:h-full');
});

test('uses Otoño for first-semester roadmaps', () => {
  useRoadmapMock.mockReturnValue(roadmapActions());
  render(
    <RoadmapCanvas
      identifier={{ ...identifier, semester: 1 }}
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={1}
    />,
  );

  expect(screen.getByText('Otoño 2026')).toBeTruthy();
});

test('creates nodes from the floating canvas button', async () => {
  const user = userEvent.setup();
  const addNode = vi.fn().mockImplementation(async (_node, _position, onCreated) => {
    onCreated?.('created-node');
    return true;
  });
  useRoadmapMock.mockReturnValue(roadmapActions({ addNode }));
  renderCanvas(true);

  const floatingButton = screen.getByRole('button', { name: 'Crear en el mapa' });
  expect(floatingButton.className).toContain('rounded-full');
  expect(floatingButton.className).toContain('cursor-pointer');
  await user.pointer({ keys: '[MouseLeft>]', target: floatingButton });
  await user.pointer({ keys: '[/MouseLeft]' });
  expect(screen.getByRole('menuitem', { name: 'Crear nodo' })).toBeTruthy();
  await user.click(screen.getByRole('menuitem', { name: 'Crear nodo' }));
  const dialog = screen.getByRole('dialog', { name: 'Agregar al mapa' });
  expect(within(dialog).getByRole('combobox', { name: 'Tipo' }).textContent).toContain('Contenido');
  await user.type(within(dialog).getByLabelText('Título'), 'Repasar límites');
  await user.click(within(dialog).getByRole('button', { name: 'Agregar nodo' }));

  expect(addNode).toHaveBeenCalledWith(
    {
      title: 'Repasar límites',
      description: '',
      nodeTypeId: 'content',
      isVisible: true,
    },
    { x: 280, y: 260 },
    expect.any(Function),
  );
  await waitFor(() =>
    expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('created-node'),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('manages node types from the floating canvas button', async () => {
  const user = userEvent.setup();
  const addNodeType = vi.fn().mockResolvedValue(true);
  const updateNodeType = vi.fn().mockResolvedValue(true);
  const deleteNodeType = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ addNodeType, updateNodeType, deleteNodeType }));
  const { unmount } = renderCanvas(true);

  const floatingButton = screen.getByRole('button', { name: 'Crear en el mapa' });
  await user.pointer({ keys: '[MouseLeft>]', target: floatingButton });
  await user.pointer({ keys: '[/MouseLeft]' });
  expect(screen.getByRole('menuitem', { name: 'Gestionar tipos de nodo' })).toBeTruthy();
  await user.click(screen.getByRole('menuitem', { name: 'Gestionar tipos de nodo' }));
  const dialog = screen.getByRole('dialog', { name: 'Tipos de nodo' });
  await user.type(within(dialog).getByLabelText('Nombre'), 'Laboratorio');
  await user.click(within(dialog).getByRole('button', { name: 'Icono: sin selección' }));
  await user.click(screen.getByRole('button', { name: 'Libro abierto' }));
  await user.click(within(dialog).getByRole('button', { name: 'Color: sin selección' }));
  await user.click(screen.getByRole('button', { name: 'Azul institucional' }));
  await user.click(within(dialog).getByRole('button', { name: 'Crear tipo' }));

  expect(addNodeType).toHaveBeenCalledWith({
    name: 'Laboratorio',
    icon: 'BookOpen',
    color: '#024AD8',
  });
  expect(screen.getByRole('dialog', { name: 'Tipos de nodo' })).toBeTruthy();

  const customType = {
    id: 'lab',
    name: 'Laboratorio',
    icon: 'BookOpen',
    color: '#024AD8',
    isPredefined: false,
  };
  unmount();
  useRoadmapMock.mockReturnValue(
    roadmapActions({
      roadmap: { ...roadmap, nodeTypes: [...roadmap.nodeTypes, customType] },
      updateNodeType,
      deleteNodeType,
    }),
  );
  renderCanvas(true);
  await user.pointer({
    keys: '[MouseLeft>]',
    target: screen.getByRole('button', { name: 'Crear en el mapa' }),
  });
  await user.pointer({ keys: '[/MouseLeft]' });
  await user.click(screen.getByRole('menuitem', { name: 'Gestionar tipos de nodo' }));
  const managementDialog = screen.getByRole('dialog', { name: 'Tipos de nodo' });
  await user.click(
    within(managementDialog).getByRole('button', { name: 'Editar tipo Laboratorio' }),
  );
  const nameInput = within(managementDialog).getByLabelText('Nombre');
  await user.clear(nameInput);
  await user.type(nameInput, 'Laboratorio de código');
  await user.click(within(managementDialog).getByRole('button', { name: 'Guardar tipo' }));
  expect(updateNodeType).toHaveBeenCalledWith('lab', {
    name: 'Laboratorio de código',
    icon: 'BookOpen',
    color: '#024AD8',
  });

  await user.click(
    within(managementDialog).getByRole('button', { name: 'Eliminar tipo Laboratorio' }),
  );
  await user.click(screen.getByRole('button', { name: 'Eliminar' }));
  expect(deleteNodeType).toHaveBeenCalledWith('lab');
});

test('confirms, cancels, and deletes every selected dependency', async () => {
  const user = userEvent.setup();
  const deleteDependency = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ deleteDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminación de dependencias' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Confirmar eliminación' });
  expect(dialog.textContent).toContain(
    'Eliminarás estas dependencias. Esta acción no se puede deshacer.',
  );
  await user.keyboard('{Enter}');
  expect(deleteDependency).toHaveBeenNthCalledWith(1, 'dependency-1');
  expect(deleteDependency).toHaveBeenNthCalledWith(2, 'dependency-2');

  deleteDependency.mockClear();
  await user.click(screen.getByRole('button', { name: 'Solicitar eliminación de dependencias' }));

  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(deleteDependency).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminación de dependencias' }));
  await user.click(screen.getByRole('button', { name: 'Eliminar' }));
  expect(deleteDependency).toHaveBeenNthCalledWith(1, 'dependency-1');
  expect(deleteDependency).toHaveBeenNthCalledWith(2, 'dependency-2');
});

test('closes the selected-node sidebar on Escape without tying that behavior to canvas clicks', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  expect(screen.getByTestId('editor-panel')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Cerrar nodo con Escape' }));
  expect(screen.queryByTestId('editor-panel')).toBeNull();
});

test('closes the editor sidebar on Escape when the selected node is no longer available', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo inexistente' }));
  expect(screen.getByTestId('editor-panel')).toBeTruthy();

  await user.keyboard('{Escape}');
  expect(screen.queryByTestId('editor-panel')).toBeNull();
});

test('persists a position reached with the keyboard', async () => {
  const user = userEvent.setup();
  const moveNode = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ moveNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Mover nodo con teclado' }));

  expect(moveNode).toHaveBeenCalledWith('node-1', { x: 20, y: 0 });
});

test('toggles the selected editor sidebar with the platform shortcut', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);
  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));

  await user.keyboard('{Meta>}b{/Meta}');
  expect(screen.queryByTestId('editor-panel')).toBeNull();

  await user.keyboard('{Meta>}b{/Meta}');
  expect(screen.getByTestId('editor-panel')).toBeTruthy();

  await user.keyboard('{Control>}b{/Control}');
  expect(screen.queryByTestId('editor-panel')).toBeNull();
});

test('previews and confirms the node visibility action before changing it', async () => {
  const user = userEvent.setup();
  const toggleVisibility = vi.fn();
  const previewNodeVisibility = vi
    .fn()
    .mockResolvedValue([{ id: 'dependency-1', sourceNodeId: 'node-1', targetNodeId: 'node-2' }]);
  useRoadmapMock.mockReturnValue(roadmapActions({ toggleVisibility, previewNodeVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar ocultación' });
  expect(dialog.textContent).toContain('1 dependencia');
  expect(dialog.textContent).toContain('Límites');
  expect(dialog.textContent).toContain('node-2');
  expect(
    within(dialog).getByRole('heading', { name: 'Dependencias que se eliminarán' }),
  ).toBeTruthy();
  expect(within(dialog).getByText('conduce a')).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(toggleVisibility).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
  const confirmation = await screen.findByRole('alertdialog', { name: 'Confirmar ocultación' });
  await user.click(within(confirmation).getByRole('button', { name: 'Ocultar' }));
  expect(toggleVisibility).toHaveBeenCalledWith('node-1', true);
});

test('omits the dependency section when hiding a node without dependencies', async () => {
  const user = userEvent.setup();
  const toggleVisibility = vi.fn();
  const previewNodeVisibility = vi.fn().mockResolvedValue([]);
  useRoadmapMock.mockReturnValue(roadmapActions({ toggleVisibility, previewNodeVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar ocultación' });

  expect(dialog.textContent).toContain('Ocultarás este nodo. No posee dependencias.');
  expect(
    within(dialog).queryByRole('heading', { name: 'Dependencias que se eliminarán' }),
  ).toBeNull();
  expect(within(dialog).queryByRole('list', { name: 'Dependencias que se eliminarán' })).toBeNull();

  await user.click(within(dialog).getByRole('button', { name: 'Ocultar' }));
  expect(toggleVisibility).toHaveBeenCalledWith('node-1', true);
});

test('confirms a teacher block from the most recent preview before mutating', async () => {
  const user = userEvent.setup();
  const previewTeacherBlock = vi.fn().mockResolvedValue([
    { id: 'node-1', title: 'Límites' },
    { id: 'node-2', title: 'Continuidad' },
  ]);
  const changeTeacherBlock = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Bloquear acceso' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo docente' });
  expect(previewTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK');
  expect(dialog.textContent).toContain('Bloquearás 2 nodos.');
  expect(dialog.textContent).toContain('Límites');
  expect(dialog.textContent).toContain('Continuidad');
  expect(dialog.textContent).toContain('puede afectar el acceso y progreso estudiantil');

  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(changeTeacherBlock).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Bloquear acceso' }));
  await user.click(
    within(await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo docente' })).getByRole(
      'button',
      { name: 'Bloquear acceso' },
    ),
  );
  await waitFor(() => expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK'));
});

test('requires a renewed confirmation when the teacher-block preview changed', async () => {
  const user = userEvent.setup();
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce([{ id: 'node-1', title: 'Límites' }])
    .mockResolvedValueOnce([
      { id: 'node-1', title: 'Límites' },
      { id: 'node-3', title: 'Derivadas' },
    ])
    .mockResolvedValueOnce([
      { id: 'node-1', title: 'Límites' },
      { id: 'node-3', title: 'Derivadas' },
    ]);
  const changeTeacherBlock = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Bloquear acceso' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo docente' });
  await user.click(within(dialog).getByRole('button', { name: 'Bloquear acceso' }));

  expect(changeTeacherBlock).not.toHaveBeenCalled();
  expect(dialog.textContent).toContain('Bloquearás 2 nodos.');
  expect(dialog.textContent).toContain('Derivadas');

  await user.click(within(dialog).getByRole('button', { name: 'Bloquear acceso' }));
  await waitFor(() => expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK'));
});

test('previews and confirms a dependency that propagates teacher blocks', async () => {
  const user = userEvent.setup();
  const connectNodes = vi.fn();
  const previewRoadmapDependency = vi.fn().mockResolvedValue([
    { id: 'target-node', title: 'Destino afectado' },
    { id: 'descendant-node', title: 'Descendiente afectado' },
  ]);
  useRoadmapMock.mockReturnValue(roadmapActions({ connectNodes, previewRoadmapDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo' });
  expect(dialog.textContent).toContain('Destino afectado');
  expect(dialog.textContent).toContain('Descendiente afectado');
  await user.click(within(dialog).getByRole('button', { name: 'Conectar y bloquear' }));

  expect(connectNodes).toHaveBeenCalledWith('source-node', 'target-node', 'right', 'left');
});

test('persists every repositioned node after ordering the map', async () => {
  const user = userEvent.setup();
  const moveNode = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ moveNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Ordenar mapa' }));
  expect(moveNode).toHaveBeenCalledWith('node-1', { x: 40, y: 80 });
});

test('starts with the editor closed and opens it when selecting a node', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  expect(screen.queryByTestId('editor-panel')).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  expect(screen.getByTestId('editor-panel')).toBeTruthy();
});

test('replaces the editor with the shared student detail and keeps its completion local', async () => {
  const user = userEvent.setup();
  const completeNode = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ completeNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar' }));

  expect(screen.queryByTestId('editor-panel')).toBeNull();
  expect(screen.getByTestId('student-detail').textContent).toContain('Vista previa docente');
  expect(screen.getByTestId('student-detail').textContent).toContain('available');

  await user.click(screen.getByRole('button', { name: 'Completar' }));
  expect(screen.getByTestId('student-detail').textContent).toContain('completed');
  expect(completeNode).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
  expect(screen.getByTestId('editor-panel')).toBeTruthy();
});

test('hides the editor when deselecting its node', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Deseleccionar nodo' }));

  expect(screen.queryByTestId('editor-panel')).toBeNull();
});

test('surfaces a mutation error as a dismissible toast over the canvas', async () => {
  const user = userEvent.setup();
  const dismissError = vi.fn();
  useRoadmapMock.mockReturnValue(
    roadmapActions({ error: 'La dependencia ya existe.', dismissError }),
  );
  renderCanvas(true);

  expect(screen.getByRole('alert', { name: 'La dependencia ya existe.' }).textContent).toBe(
    'La dependencia ya existe.',
  );

  await user.click(screen.getByRole('button', { name: 'Cerrar alerta' }));
  expect(dismissError).toHaveBeenCalled();
});

test('confirms that a node update was saved successfully', async () => {
  const user = userEvent.setup();
  const updateNode = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ updateNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

  expect(
    await screen.findByRole('status', { name: 'Cambios guardados exitosamente.' }),
  ).toBeTruthy();
  expect(updateNode).toHaveBeenCalledWith('node-1', { title: 'Límites' });
});

test('confirms that a link was saved successfully', async () => {
  const user = userEvent.setup();
  const addResource = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ addResource }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Guardar enlace' }));

  expect(await screen.findByRole('status', { name: 'Enlace guardado exitosamente.' })).toBeTruthy();
  expect(addResource).toHaveBeenCalledWith('node-1', {
    title: 'Guía de ejercicios',
    url: 'https://example.test/guia',
    type: 'LINK',
  });
});

test('surfaces a concurrent hidden-node dependency error over the canvas', async () => {
  const dismissError = vi.fn();
  useRoadmapMock.mockReturnValue(
    roadmapActions({
      error: 'No se pueden crear dependencias con nodos ocultos.',
      dismissError,
    }),
  );
  renderCanvas(true);

  expect(
    screen.getByRole('alert', { name: 'No se pueden crear dependencias con nodos ocultos.' }),
  ).toBeTruthy();
});

test('does not select a blocked student node', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(
    roadmapActions({
      roadmap: {
        ...roadmap,
        nodes: [
          {
            id: 'blocked-node',
            title: 'Nodo bloqueado',
            nodeTypeId: 'content',
            positionX: 0,
            positionY: 0,
            access: { status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' },
          },
        ],
      },
    }),
  );
  renderCanvas();

  await user.click(screen.getByRole('button', { name: 'Activar nodo bloqueado' }));

  expect(screen.queryByTestId('student-detail')).toBeNull();
});
