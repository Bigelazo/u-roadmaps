import { forwardRef, type ReactNode, useImperativeHandle, useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { RoadmapCanvas } from '@/features/roadmap';

const { useRoadmapMock } = vi.hoisted(() => ({ useRoadmapMock: vi.fn() }));

vi.mock('next/dynamic', () => ({
  default: () =>
    forwardRef(function RoadmapEditorMock(
      {
        selectedNode,
        isOpen,
        onToggle,
        onClose,
        onPreview,
        onRequestTeacherBlock,
        onToggleVisibility,
        onUpdateNode,
        onAddResource,
        isVisibilityPending,
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
        onRequestTeacherBlock: (
          nodeId: string,
          operation: 'BLOCK' | 'UNBLOCK' | 'BRANCH_UNLOCK',
        ) => void;
        onToggleVisibility: (nodeId: string, isVisible: boolean) => void;
        onUpdateNode: (nodeId: string, node: unknown) => Promise<boolean>;
        onAddResource: (nodeId: string, resource: unknown) => Promise<boolean>;
        isVisibilityPending: boolean;
      },
      ref,
    ) {
      const [isDirty, setIsDirty] = useState(false);
      useImperativeHandle(
        ref,
        () => ({
          draftNodeId: selectedNode?.id ?? null,
          isDirty,
          reset: () => setIsDirty(false),
        }),
        [isDirty, selectedNode?.id],
      );

      return isOpen ? (
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
                Bloquear rama
              </button>
              <button
                type="button"
                onClick={() => onRequestTeacherBlock(selectedNode.id, 'UNBLOCK')}
              >
                Desbloquear
              </button>
              <button
                type="button"
                disabled={isVisibilityPending}
                onClick={() => onToggleVisibility(selectedNode.id, true)}
              >
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
              <button type="button" onClick={() => setIsDirty(true)}>
                Marcar borrador sin guardar
              </button>
            </>
          ) : null}
        </aside>
      ) : null;
    }),
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
    roadmap,
    canEdit,
    isTeacherView,
    onViewportChange,
    restoreViewport,
    onRequestVisibilityAction,
    onRequestAddResource,
    onRequestDelete,
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
    roadmap: { roadmap: { id: string } };
    canEdit: boolean;
    isTeacherView?: boolean;
    onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
    restoreViewport?: { x: number; y: number; zoom: number } | null;
    onRequestVisibilityAction?: (nodeId: string, isVisible: boolean) => void;
    onRequestAddResource?: (nodeId: string) => void;
    onRequestDelete?: (nodeId: string) => void;
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
      <output data-testid="roadmap-mode">{canEdit ? 'editing' : 'student'}</output>
      <output data-testid="roadmap-projection">{isTeacherView ? 'teacher' : 'student'}</output>
      <output data-testid="displayed-roadmap">{roadmap.roadmap.id}</output>
      <output data-testid="restored-viewport">{restoreViewport?.x ?? 'none'}</output>
      <button
        type="button"
        onClick={() => onSelectNode('blocked-node', document.createElement('div'))}
      >
        Activar nodo bloqueado
      </button>
      <button type="button" onClick={() => onSelectNode('node-1', document.createElement('div'))}>
        Activar nodo docente
      </button>
      <button type="button" onClick={() => onRequestVisibilityAction?.('node-1', true)}>
        Solicitar ocultar nodo
      </button>
      <button type="button" onClick={() => onRequestVisibilityAction?.('node-1', false)}>
        Solicitar mostrar nodo
      </button>
      <button type="button" onClick={() => onRequestAddResource?.('node-1')}>
        Agregar recurso al nodo actual
      </button>
      <button type="button" onClick={() => onRequestAddResource?.('node-2')}>
        Agregar recurso a otro nodo
      </button>
      <button type="button" onClick={() => onRequestDelete?.('node-1')}>
        Solicitar eliminar nodo
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
      <button type="button" onClick={() => onViewportChange?.({ x: 100, y: 0, zoom: 1 })}>
        Mover viewport a 100
      </button>
      <button type="button" onClick={() => onViewportChange?.({ x: 400, y: 0, zoom: 1 })}>
        Mover viewport a 400
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
    isReadOnly,
    panelWidth,
  }: {
    node?: { title: string };
    status: string | null;
    onClose: () => void;
    onComplete: (node: { title: string }) => void;
    isReadOnly?: boolean;
    panelWidth?: number;
  }) =>
    node ? (
      <aside data-testid="student-detail" data-panel-width={panelWidth}>
        <p>{node.title}</p>
        <p>{status}</p>
        <button type="button" disabled={isReadOnly} onClick={() => onComplete(node)}>
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
    previewTeacherBlock: vi
      .fn()
      .mockResolvedValue({ mode: 'BLOCK', version: 'preview', nodes: [] }),
    changeTeacherBlock: vi.fn(),
    deleteDependency: vi.fn(),
    toggleVisibility: vi.fn(),
    previewNodeVisibility: vi.fn().mockResolvedValue([]),
    previewNodeDeletion: vi.fn().mockResolvedValue({
      node: {
        title: 'Límites',
        nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
      },
      dependencies: [],
      resources: [],
      version: 'delete-preview',
    }),
    deleteNode: vi.fn(),
    addResource: vi.fn(),
    updateResource: vi.fn(),
    deleteResource: vi.fn(),
    addNodeType: vi.fn(),
    updateNodeType: vi.fn(),
    deleteNodeType: vi.fn(),
    completeNode: vi.fn(),
    simulationRoadmap: null,
    loadSimulation: vi.fn().mockResolvedValue(true),
    completeSimulatedNode: vi.fn().mockResolvedValue(true),
    resetSimulation: vi.fn().mockResolvedValue(true),
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
  expect(within(shortcuts).getAllByText('Flechas')).toHaveLength(2);
  expect(within(shortcuts).getByLabelText('Shift')).toBeTruthy();
  expect(within(shortcuts).getByText('Tab')).toBeTruthy();
  expect(within(shortcuts).getByText('Ctrl')).toBeTruthy();
  expect(
    within(shortcuts).getByText(
      /Con el borde del panel enfocado, establecer su ancho mínimo o máximo/,
    ),
  ).toBeTruthy();
  const canvas = screen.getByLabelText('Lienzo del roadmap');
  expect(canvas.className).toContain('lg:min-h-0');
  expect(shortcuts.getAttribute('data-placement')).toBe('roadmap');
  expect(canvas.parentElement?.className).toContain('lg:grid-rows-[minmax(0,1fr)]');
  expect(canvas.parentElement?.parentElement?.className).toContain('lg:h-full');
});

test('hides editor-only keyboard shortcuts from students', () => {
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas();

  const shortcuts = screen.getByRole('group', { name: 'Atajos de teclado' });
  expect(within(shortcuts).queryByText('Flechas')).toBeNull();
  expect(
    within(shortcuts).queryByText('Eliminar la dependencia seleccionada, con confirmación.'),
  ).toBeNull();
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
  const deleteNodeType = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
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
  const deletionDialog = await screen.findByRole('alertdialog', {
    name: 'Confirmar eliminación',
  });
  expect(deletionDialog.getAttribute('data-intent')).toBe('destructive');
  expect(within(deletionDialog).getByRole('listitem', { name: 'Laboratorio' })).toBeTruthy();
  await user.click(within(deletionDialog).getByRole('button', { name: 'Cancelar' }));
  expect(deleteNodeType).not.toHaveBeenCalled();

  await user.click(
    within(managementDialog).getByRole('button', { name: 'Eliminar tipo Laboratorio' }),
  );
  const retryDialog = await screen.findByRole('alertdialog', { name: 'Confirmar eliminación' });
  const confirm = within(retryDialog).getByRole('button', { name: 'Eliminar' });
  await user.click(confirm);
  await waitFor(() => expect(deleteNodeType).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole('alertdialog', { name: 'Confirmar eliminación' })).toBeTruthy();

  await user.click(confirm);
  await waitFor(() => expect(deleteNodeType).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('confirms, cancels, and deletes every selected dependency', async () => {
  const user = userEvent.setup();
  const deleteDependency = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ deleteDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminación de dependencias' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Confirmar eliminación' });
  expect(dialog.getAttribute('data-intent')).toBe('destructive');
  expect(dialog.textContent).toContain(
    'Eliminarás estas dependencias. Esta acción no se puede deshacer.',
  );
  await user.keyboard('{Enter}');
  expect(deleteDependency).toHaveBeenCalledTimes(2);
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
  expect(dialog.getAttribute('data-intent')).toBe('destructive');
  expect(within(dialog).getByRole('listitem', { name: 'Límites' })).toBeTruthy();
  expect(dialog.textContent).toContain('1 dependencia');
  expect(dialog.textContent).toContain('Límites');
  expect(dialog.textContent).toContain('node-2');
  expect(
    within(dialog).getByRole('heading', { name: 'Dependencias que se eliminarán' }),
  ).toBeTruthy();
  expect(
    within(within(dialog).getByRole('list', { name: 'Dependencias que se eliminarán' })).getByRole(
      'listitem',
      { name: 'Relación: Límites → node-2' },
    ),
  ).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(toggleVisibility).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
  const confirmation = await screen.findByRole('alertdialog', { name: 'Confirmar ocultación' });
  await user.click(within(confirmation).getByRole('button', { name: 'Ocultar' }));
  expect(toggleVisibility).toHaveBeenCalledWith('node-1', true);
});

test('shows an explicit empty dependency state when hiding a node without dependencies', async () => {
  const user = userEvent.setup();
  const toggleVisibility = vi.fn();
  const previewNodeVisibility = vi.fn().mockResolvedValue([]);
  useRoadmapMock.mockReturnValue(roadmapActions({ toggleVisibility, previewNodeVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar ocultación' });

  expect(dialog.textContent).toContain('desaparecerá del Roadmap del estudiantado');
  expect(dialog.textContent).toContain('se quitará su Bloqueo docente');
  expect(dialog.textContent).toContain('no posee Dependencias');
  const dependencies = within(dialog).getByRole('region', {
    name: 'Dependencias que se eliminarán',
  });
  expect(within(dependencies).getByText('No hay Dependencias relacionadas.')).toBeTruthy();

  await user.click(within(dialog).getByRole('button', { name: 'Ocultar' }));
  expect(toggleVisibility).toHaveBeenCalledWith('node-1', true);
});

test('confirms showing a node with the approved message before changing it', async () => {
  const user = userEvent.setup();
  const toggleVisibility = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ toggleVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar mostrar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar publicación' });
  expect(dialog.getAttribute('data-intent')).toBe('default');
  const approvedMessage =
    'Este Nodo se mostrará al estudiantado y quedará disponible inmediatamente. No tendrá Dependencias ni Bloqueo docente.';
  expect(within(dialog).getByText(approvedMessage).textContent).toBe(approvedMessage);
  expect(
    within(within(dialog).getByRole('region', { name: 'Nodo que se publicará' })).getByRole(
      'listitem',
      { name: 'Límites' },
    ),
  ).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Mostrar' }));
  expect(toggleVisibility).toHaveBeenCalledWith('node-1', false);
});

test('prevents duplicate visibility previews while loading their impact', async () => {
  const user = userEvent.setup();
  let resolvePreview!: (dependencies: []) => void;
  const previewNodeVisibility = vi.fn(
    () =>
      new Promise<[]>((resolve) => {
        resolvePreview = resolve;
      }),
  );
  useRoadmapMock.mockReturnValue(roadmapActions({ previewNodeVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  const visibilityControl = screen.getByRole('button', {
    name: 'Ocultar para estudiantes',
  }) as HTMLButtonElement;
  await user.click(visibilityControl);

  await waitFor(() => expect(visibilityControl.disabled).toBe(true));
  await user.click(visibilityControl);
  expect(previewNodeVisibility).toHaveBeenCalledTimes(1);

  resolvePreview([]);
  expect(await screen.findByRole('alertdialog', { name: 'Confirmar ocultación' })).toBeTruthy();
});

test('keeps a failed visibility mutation recoverable and blocks duplicate confirmation', async () => {
  const user = userEvent.setup();
  let resolveFirstAttempt!: (changed: boolean) => void;
  const toggleVisibility = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveFirstAttempt = resolve;
        }),
    )
    .mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ toggleVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar mostrar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar publicación' });
  const confirm = within(dialog).getByRole('button', { name: 'Mostrar' }) as HTMLButtonElement;
  await user.click(within(dialog).getByRole('button', { name: 'Mostrar' }));
  await waitFor(() => expect(confirm.disabled).toBe(true));

  await user.click(confirm);
  expect(toggleVisibility).toHaveBeenCalledTimes(1);

  resolveFirstAttempt(false);
  await waitFor(() => expect(confirm.disabled).toBe(false));
  expect(screen.getByRole('alertdialog', { name: 'Confirmar publicación' })).toBeTruthy();

  await user.click(confirm);
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog', { name: 'Confirmar publicación' })).toBeNull(),
  );
  expect(toggleVisibility).toHaveBeenCalledTimes(2);
});

test('confirms a teacher block from the most recent preview before mutating', async () => {
  const user = userEvent.setup();
  const previewTeacherBlock = vi.fn().mockResolvedValue({
    mode: 'BLOCK',
    version: 'preview',
    nodes: [
      { id: 'node-1', title: 'Límites' },
      { id: 'node-2', title: 'Continuidad' },
    ],
  });
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Bloquear rama' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo de rama' });
  expect(previewTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK');
  expect(dialog.textContent).toContain('Bloquearás 2 nodos.');
  expect(dialog.textContent).toContain('Límites');
  expect(dialog.textContent).toContain('Continuidad');
  expect(dialog.textContent).toContain('puede afectar el acceso y progreso estudiantil');

  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(changeTeacherBlock).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Bloquear rama' }));
  await user.click(
    within(await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo de rama' })).getByRole(
      'button',
      { name: 'Bloquear rama' },
    ),
  );
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK', 'preview'),
  );
});

test('keeps a failed teacher-block mutation recoverable and refreshes its preview', async () => {
  const user = userEvent.setup();
  const initialPreview = {
    mode: 'BLOCK' as const,
    version: 'initial',
    nodes: [{ id: 'node-1', title: 'Límites' }],
  };
  const refreshedPreview = {
    mode: 'BLOCK' as const,
    version: 'refreshed',
    nodes: [
      { id: 'node-1', title: 'Límites actualizado' },
      { id: 'node-2', title: 'Continuidad' },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(initialPreview)
    .mockResolvedValueOnce(initialPreview)
    .mockResolvedValueOnce(refreshedPreview)
    .mockResolvedValue(refreshedPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Bloquear rama' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo de rama' });
  const confirm = within(dialog).getByRole('button', { name: 'Bloquear rama' });

  await user.click(confirm);
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK', 'initial'),
  );
  await waitFor(() => expect(dialog.textContent).toContain('Límites actualizado'));
  expect(dialog.textContent).toContain('Bloquearás 2 nodos.');
  expect(changeTeacherBlock).toHaveBeenCalledTimes(1);

  await user.click(confirm);
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK', 'refreshed'),
  );
  expect(changeTeacherBlock).toHaveBeenCalledTimes(2);
});

test('requires a renewed confirmation when the teacher-block preview changed', async () => {
  const user = userEvent.setup();
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce({
      mode: 'BLOCK',
      version: 'one',
      nodes: [{ id: 'node-1', title: 'Límites' }],
    })
    .mockResolvedValueOnce({
      mode: 'BLOCK',
      version: 'two',
      nodes: [
        { id: 'node-1', title: 'Límites' },
        { id: 'node-3', title: 'Derivadas' },
      ],
    })
    .mockResolvedValueOnce({
      mode: 'BLOCK',
      version: 'two',
      nodes: [
        { id: 'node-1', title: 'Límites' },
        { id: 'node-3', title: 'Derivadas' },
      ],
    });
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Bloquear rama' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo de rama' });
  await user.click(within(dialog).getByRole('button', { name: 'Bloquear rama' }));

  expect(changeTeacherBlock).not.toHaveBeenCalled();
  expect(dialog.textContent).toContain('Bloquearás 2 nodos.');
  expect(dialog.textContent).toContain('Derivadas');

  await user.click(within(dialog).getByRole('button', { name: 'Bloquear rama' }));
  await waitFor(() => expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BLOCK', 'two'));
});

test('shows both unlock scopes as declarative sections and confirms individual operation', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [
      {
        id: 'node-1',
        title: 'Límites',
        relation: 'SELECTED_NODE' as const,
        nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
      },
    ],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      {
        id: 'node-1',
        title: 'Límites',
        relation: 'SELECTED_NODE' as const,
        nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
      },
      {
        id: 'node-2',
        title: 'Continuidad',
        relation: 'DEPENDENT' as const,
        nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
      },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });
  const individualSection = within(dialog).getByRole('region', { name: 'Solo este Nodo' });
  const branchSection = within(dialog).getByRole('region', { name: 'Este Nodo y su rama' });
  expect(within(individualSection).getByRole('listitem', { name: 'Límites' })).toBeTruthy();
  expect(within(individualSection).getByText('Nodo seleccionado')).toBeTruthy();
  expect(within(individualSection).getByText('Contenido')).toBeTruthy();
  expect(within(branchSection).getByRole('listitem', { name: 'Límites' })).toBeTruthy();
  expect(within(branchSection).getByRole('listitem', { name: 'Continuidad' })).toBeTruthy();
  expect(within(branchSection).getByText('Nodo seleccionado')).toBeTruthy();
  expect(within(branchSection).getByText('Dependiente')).toBeTruthy();
  expect(within(branchSection).getAllByText('Contenido')).toHaveLength(2);
  expect(within(dialog).getAllByLabelText('Contenido')).toHaveLength(3);
  expect(within(dialog).queryAllByRole('radio')).toHaveLength(0);

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'UNBLOCK', 'single'),
  );
});

test('confirms the branch unlock alternative from the same preview pair', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [
      {
        id: 'node-1',
        title: 'Límites',
        relation: 'SELECTED_NODE' as const,
      },
    ],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(individualPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });
  expect(within(dialog).getByText('Continuidad')).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear la rama' }));

  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BRANCH_UNLOCK', 'branch'),
  );
});

test('revalidates only the individual unlock preview before mutating', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(individualPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));

  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'UNBLOCK', 'single'),
  );
  expect(previewTeacherBlock).toHaveBeenCalledTimes(3);
  expect(previewTeacherBlock).toHaveBeenNthCalledWith(3, 'node-1', 'UNBLOCK');
});

test('revalidates only the branch unlock preview before mutating', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(branchPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear la rama' }));

  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'BRANCH_UNLOCK', 'branch'),
  );
  expect(previewTeacherBlock).toHaveBeenCalledTimes(3);
  expect(previewTeacherBlock).toHaveBeenNthCalledWith(3, 'node-1', 'BRANCH_UNLOCK');
});

test('disables both unlock actions while revalidating and marks only the chosen action pending', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  let resolveRevalidation!: (preview: typeof individualPreview) => void;
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockImplementationOnce(
      () =>
        new Promise<typeof individualPreview>((resolve) => {
          resolveRevalidation = resolve;
        }),
    );
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });
  const individualAction = within(dialog).getByRole('button', {
    name: 'Desbloquear este Nodo',
  });
  const branchAction = within(dialog).getByRole('button', { name: 'Desbloquear la rama' });
  const cancel = within(dialog).getByRole('button', { name: 'Cancelar' });

  await user.click(individualAction);

  await waitFor(() => {
    expect((individualAction as HTMLButtonElement).disabled).toBe(true);
    expect((branchAction as HTMLButtonElement).disabled).toBe(true);
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
  });
  expect(individualAction.getAttribute('aria-busy')).toBe('true');
  expect(within(individualAction).getByTestId('confirmation-progress')).toBeTruthy();
  expect(branchAction.getAttribute('aria-busy')).toBeNull();
  expect(within(branchAction).queryByTestId('confirmation-progress')).toBeNull();

  resolveRevalidation(individualPreview);
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'UNBLOCK', 'single'),
  );
});

test('keeps both unlock scopes recoverable after a failed mutation', async () => {
  const user = userEvent.setup();
  const individualPreview = {
    mode: 'SINGLE' as const,
    version: 'single',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const branchPreview = {
    mode: 'BRANCH' as const,
    version: 'branch',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const refreshedIndividualPreview = {
    mode: 'SINGLE' as const,
    version: 'single-refreshed',
    nodes: [{ id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const }],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(branchPreview)
    .mockResolvedValueOnce(individualPreview)
    .mockResolvedValueOnce(refreshedIndividualPreview)
    .mockResolvedValueOnce(refreshedIndividualPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenNthCalledWith(1, 'node-1', 'UNBLOCK', 'single'),
  );
  await waitFor(() => expect(dialog.textContent).toContain('Límites actualizado'));
  expect(within(dialog).getByRole('list', { name: 'Solo este Nodo' })).toBeTruthy();
  expect(within(dialog).getByRole('list', { name: 'Este Nodo y su rama' })).toBeTruthy();
  expect(
    (within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenNthCalledWith(2, 'node-1', 'UNBLOCK', 'single-refreshed'),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('uses one affirmative action when blocked prerequisites determine the unlock scope', async () => {
  const user = userEvent.setup();
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce({
      mode: 'UPSTREAM' as const,
      version: 'upstream',
      nodes: [
        { id: 'node-0', title: 'Base', relation: 'PREREQUISITE' as const },
        { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      ],
    })
    .mockResolvedValueOnce({
      mode: 'UPSTREAM' as const,
      version: 'upstream',
      nodes: [
        { id: 'node-0', title: 'Base', relation: 'PREREQUISITE' as const },
        { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      ],
    });
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Desbloquear prerrequisitos' });
  expect(within(dialog).getAllByRole('button')).toHaveLength(2);
  expect(within(dialog).queryByRole('button', { name: 'Desbloquear la rama' })).toBeNull();
  expect(within(dialog).getByRole('button', { name: 'Desbloquear 2 nodos' })).toBeTruthy();

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear 2 nodos' }));
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'UNBLOCK', 'upstream'),
  );
});

test('refreshes both unlock scopes and requires a new action when the selected preview is stale', async () => {
  const user = userEvent.setup();
  const initialIndividual = {
    mode: 'SINGLE' as const,
    version: 'single-one',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const initialBranch = {
    mode: 'BRANCH' as const,
    version: 'branch-one',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const refreshedIndividual = {
    mode: 'SINGLE' as const,
    version: 'single-two',
    nodes: [{ id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const }],
  };
  const refreshedBranch = {
    mode: 'BRANCH' as const,
    version: 'branch-two',
    nodes: [
      { id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const },
      { id: 'node-3', title: 'Derivadas', relation: 'DEPENDENT' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(initialIndividual)
    .mockResolvedValueOnce(initialBranch)
    .mockResolvedValueOnce(refreshedIndividual)
    .mockResolvedValueOnce(refreshedBranch)
    .mockResolvedValueOnce(refreshedIndividual)
    .mockResolvedValueOnce(refreshedBranch);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });
  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));

  await waitFor(() => expect(previewTeacherBlock).toHaveBeenCalledTimes(4));
  expect(changeTeacherBlock).not.toHaveBeenCalled();
  expect(dialog.textContent).toContain('Límites actualizado');
  expect(dialog.textContent).toContain('Derivadas');

  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));
  await waitFor(() =>
    expect(changeTeacherBlock).toHaveBeenCalledWith('node-1', 'UNBLOCK', 'single-two'),
  );
});

test('switches to upstream confirmation when the companion scope becomes upstream', async () => {
  const user = userEvent.setup();
  const initialIndividual = {
    mode: 'SINGLE' as const,
    version: 'single-one',
    nodes: [{ id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const }],
  };
  const initialBranch = {
    mode: 'BRANCH' as const,
    version: 'branch-one',
    nodes: [
      { id: 'node-1', title: 'Límites', relation: 'SELECTED_NODE' as const },
      { id: 'node-2', title: 'Continuidad', relation: 'DEPENDENT' as const },
    ],
  };
  const refreshedIndividual = {
    mode: 'SINGLE' as const,
    version: 'single-two',
    nodes: [{ id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const }],
  };
  const upstreamPreview = {
    mode: 'UPSTREAM' as const,
    version: 'upstream-one',
    nodes: [
      { id: 'node-0', title: 'Base', relation: 'PREREQUISITE' as const },
      { id: 'node-1', title: 'Límites actualizado', relation: 'SELECTED_NODE' as const },
    ],
  };
  const previewTeacherBlock = vi
    .fn()
    .mockResolvedValueOnce(initialIndividual)
    .mockResolvedValueOnce(initialBranch)
    .mockResolvedValueOnce(refreshedIndividual)
    .mockResolvedValueOnce(upstreamPreview);
  const changeTeacherBlock = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewTeacherBlock, changeTeacherBlock }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar desbloqueo' });
  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear este Nodo' }));

  await waitFor(() => expect(previewTeacherBlock).toHaveBeenCalledTimes(4));
  expect(changeTeacherBlock).not.toHaveBeenCalled();
  expect(screen.getByRole('alertdialog', { name: 'Desbloquear prerrequisitos' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Desbloquear la rama' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Desbloquear 2 nodos' })).toBeTruthy();
});

test('previews and confirms a dependency that propagates teacher blocks', async () => {
  const user = userEvent.setup();
  const connectNodes = vi.fn().mockResolvedValue(true);
  const previewRoadmapDependency = vi.fn().mockResolvedValue([
    { id: 'target-node', title: 'Destino afectado' },
    { id: 'descendant-node', title: 'Descendiente afectado' },
  ]);
  useRoadmapMock.mockReturnValue(roadmapActions({ connectNodes, previewRoadmapDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo' });
  expect(
    within(dialog).getByRole('listitem', {
      name: 'Relación: source-node → target-node',
    }),
  ).toBeTruthy();
  expect(within(dialog).getByRole('list', { name: 'Nodos que se bloquearán' })).toBeTruthy();
  expect(dialog.textContent).toContain('Destino afectado');
  expect(dialog.textContent).toContain('Descendiente afectado');
  await user.click(within(dialog).getByRole('button', { name: 'Conectar y bloquear' }));

  await waitFor(() =>
    expect(connectNodes).toHaveBeenCalledWith('source-node', 'target-node', 'right', 'left'),
  );
});

test('connects an unaffected dependency immediately without opening a confirmation', async () => {
  const user = userEvent.setup();
  const connectNodes = vi.fn().mockResolvedValue(true);
  const previewRoadmapDependency = vi.fn().mockResolvedValue([]);
  useRoadmapMock.mockReturnValue(roadmapActions({ connectNodes, previewRoadmapDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));

  await waitFor(() =>
    expect(connectNodes).toHaveBeenCalledWith('source-node', 'target-node', 'right', 'left'),
  );
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('keeps an impacted dependency confirmation recoverable after cancellation and failure', async () => {
  const user = userEvent.setup();
  const connectNodes = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const previewRoadmapDependency = vi
    .fn()
    .mockResolvedValue([{ id: 'target-node', title: 'Destino afectado' }]);
  useRoadmapMock.mockReturnValue(roadmapActions({ connectNodes, previewRoadmapDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));
  let dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo' });
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(connectNodes).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));
  dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo' });
  const confirm = within(dialog).getByRole('button', { name: 'Conectar y bloquear' });
  await user.click(confirm);
  await waitFor(() => expect(connectNodes).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole('alertdialog', { name: 'Confirmar bloqueo' })).toBeTruthy();

  await user.click(confirm);
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(connectNodes).toHaveBeenCalledTimes(2);
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
  expect(screen.getByTestId('student-detail').getAttribute('data-panel-width')).toBe('360');

  await user.click(screen.getByRole('button', { name: 'Completar' }));
  expect(screen.getByTestId('student-detail').textContent).toContain('completed');
  expect(completeNode).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
  expect(screen.getByTestId('editor-panel')).toBeTruthy();
});

test('replaces a node information preview with the editor when selecting a node', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar' }));
  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));

  expect(screen.queryByTestId('student-detail')).toBeNull();
  expect(screen.getByTestId('editor-panel')).toBeTruthy();
});

test('lets teachers enter the persistent student canvas preview, complete a node, and reset it', async () => {
  const user = userEvent.setup();
  const simulationRoadmap = {
    ...roadmap,
    roadmap: { id: 'simulation-roadmap' },
    nodes: [
      {
        ...roadmap.nodes[0],
        access: { status: 'ACCESSIBLE' as const },
        isCompleted: false,
        canComplete: true,
      },
    ],
  };
  const loadSimulation = vi.fn().mockResolvedValue(true);
  const completeSimulatedNode = vi.fn().mockResolvedValue(true);
  const resetSimulation = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(
    roadmapActions({ simulationRoadmap, loadSimulation, completeSimulatedNode, resetSimulation }),
  );
  renderCanvas(true);

  expect(screen.getByRole('button', { name: 'Previsualizar canvas' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));

  expect(await screen.findByText('Previsualización del canvas')).toBeTruthy();
  expect(loadSimulation).toHaveBeenCalled();
  expect(screen.getByTestId('roadmap-mode').textContent).toBe('student');
  expect(screen.getByTestId('displayed-roadmap').textContent).toBe('simulation-roadmap');
  expect(screen.queryByRole('button', { name: 'Crear en el mapa' })).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Completar' }));
  expect(completeSimulatedNode).toHaveBeenCalledWith('node-1');

  await user.click(screen.getByRole('button', { name: 'Reiniciar progreso' }));
  const resetDialog = screen.getByRole('alertdialog', {
    name: 'Reiniciar progreso de previsualización',
  });
  expect(resetDialog.getAttribute('data-intent')).toBe('destructive');
  expect(resetDialog.textContent).toContain('completaciones simuladas');
  expect(resetDialog.textContent).toContain('Completions estudiantiles');
  await user.click(within(resetDialog).getByRole('button', { name: 'Cancelar' }));
  expect(resetSimulation).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Reiniciar progreso' }));
  const confirmation = screen.getByRole('alertdialog', {
    name: 'Reiniciar progreso de previsualización',
  });
  await user.click(within(confirmation).getByRole('button', { name: 'Reiniciar progreso' }));
  expect(resetSimulation).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole('button', { name: 'Ir al editor' }));
  expect(screen.getByTestId('roadmap-mode').textContent).toBe('editing');
});

test('confirms before discarding an unsaved editor draft to enter the canvas preview', async () => {
  const user = userEvent.setup();
  const loadSimulation = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ simulationRoadmap: roadmap, loadSimulation }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Marcar borrador sin guardar' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));

  expect(screen.getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })).toBeTruthy();
  expect(
    screen
      .getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })
      .getAttribute('data-intent'),
  ).toBe('warning');
  expect(loadSimulation).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.queryByText('Previsualización del canvas')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));
  await user.click(screen.getByRole('button', { name: 'Descartar y previsualizar' }));

  await waitFor(() => expect(loadSimulation).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Previsualización del canvas')).toBeTruthy();
});

test('opens a resource composer without warning for the current draft and confirms only before replacing it', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(
    roadmapActions({
      roadmap: {
        ...roadmap,
        nodes: [
          ...roadmap.nodes,
          {
            ...roadmap.nodes[0],
            id: 'node-2',
            title: 'Derivadas',
          },
        ],
      },
    }),
  );
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Marcar borrador sin guardar' }));
  await user.click(screen.getByRole('button', { name: 'Agregar recurso al nodo actual' }));
  expect(screen.queryByRole('alertdialog', { name: 'Descartar cambios sin guardar' })).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Agregar recurso a otro nodo' }));
  expect(screen.getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })).toBeTruthy();
  expect(
    screen
      .getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })
      .getAttribute('data-intent'),
  ).toBe('warning');
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('node-1');

  await user.click(screen.getByRole('button', { name: 'Agregar recurso a otro nodo' }));
  await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));
  await waitFor(() =>
    expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('node-2'),
  );
});

test('shows the authoritative named deletion impact and deletes only after a fresh preview', async () => {
  const user = userEvent.setup();
  const impact = {
    node: {
      title: 'Límites',
      nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
    },
    dependencies: [
      { id: 'dependency-1', sourceTitle: 'Base', targetTitle: 'Límites' },
      { id: 'dependency-2', sourceTitle: 'Límites', targetTitle: 'Derivadas' },
    ],
    resources: [{ id: 'resource-1', title: 'Guía de ejercicios' }],
    version: 'delete-preview',
  };
  const previewNodeDeletion = vi.fn().mockResolvedValue(impact);
  const deleteNode = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewNodeDeletion, deleteNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' });
  expect(dialog.getAttribute('data-intent')).toBe('destructive');
  expect(within(dialog).getByRole('listitem', { name: 'Límites' })).toBeTruthy();
  expect(within(dialog).getByRole('list', { name: 'Dependencias relacionadas' })).toBeTruthy();
  expect(within(dialog).getByRole('list', { name: 'Recursos que se eliminarán' })).toBeTruthy();
  expect(dialog.textContent).toContain('Límites');
  expect(dialog.textContent).toContain('Base');
  expect(dialog.textContent).toContain('Base');
  expect(dialog.textContent).toContain('Derivadas');
  expect(dialog.textContent).toContain('Guía de ejercicios');
  expect(dialog.textContent).not.toContain('Completaciones');
  expect(screen.getByLabelText('Contenido')).toBeTruthy();

  await user.click(within(dialog).getByRole('button', { name: 'Eliminar Nodo' }));
  await waitFor(() => expect(deleteNode).toHaveBeenCalledWith('node-1', 'delete-preview'));
  expect(previewNodeDeletion).toHaveBeenCalledTimes(2);
});

test('keeps preview-backed node deletion recoverable after a failed mutation', async () => {
  const user = userEvent.setup();
  const deleteNode = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ deleteNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' });
  const confirm = within(dialog).getByRole('button', { name: 'Eliminar Nodo' });

  await user.click(confirm);
  await waitFor(() => expect(deleteNode).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole('alertdialog', { name: 'Eliminar Nodo' })).toBeTruthy();

  await user.click(confirm);
  await waitFor(() => expect(deleteNode).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('updates a changed deletion impact and requires a renewed confirmation', async () => {
  const user = userEvent.setup();
  const initialImpact = {
    node: {
      title: 'Límites',
      nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
    },
    dependencies: [],
    resources: [],
    version: 'one',
  };
  const changedImpact = {
    ...initialImpact,
    dependencies: [{ id: 'dependency-1', sourceTitle: 'Base', targetTitle: 'Límites' }],
    version: 'two',
  };
  const previewNodeDeletion = vi
    .fn()
    .mockResolvedValueOnce(initialImpact)
    .mockResolvedValueOnce(changedImpact)
    .mockResolvedValueOnce(changedImpact);
  const deleteNode = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewNodeDeletion, deleteNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' });
  await user.click(within(dialog).getByRole('button', { name: 'Eliminar Nodo' }));

  expect(deleteNode).not.toHaveBeenCalled();
  expect(dialog.textContent).toContain('Base');
  await user.click(within(dialog).getByRole('button', { name: 'Eliminar Nodo' }));
  await waitFor(() => expect(deleteNode).toHaveBeenCalledWith('node-1', 'two'));
});

test('protects a dirty draft of the same Node before opening deletion confirmation', async () => {
  const user = userEvent.setup();
  const previewNodeDeletion = vi.fn().mockResolvedValue({
    node: {
      title: 'Límites',
      nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
    },
    dependencies: [],
    resources: [],
    version: 'delete-preview',
  });
  useRoadmapMock.mockReturnValue(roadmapActions({ previewNodeDeletion }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Marcar borrador sin guardar' }));
  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  expect(screen.getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })).toBeTruthy();
  expect(
    screen
      .getByRole('alertdialog', { name: 'Descartar cambios sin guardar' })
      .getAttribute('data-intent'),
  ).toBe('warning');
  expect(previewNodeDeletion).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.queryByRole('alertdialog', { name: 'Eliminar Nodo' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));
  await waitFor(() => expect(previewNodeDeletion).toHaveBeenCalledWith('node-1'));
  expect(screen.getByRole('alertdialog', { name: 'Eliminar Nodo' })).toBeTruthy();
});

test('does not restore a prior preview viewport when entering a later preview', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions({ simulationRoadmap: roadmap }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Mover viewport a 100' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));
  await user.click(screen.getByRole('button', { name: 'Ir al editor' }));
  expect(screen.getByTestId('restored-viewport').textContent).toBe('100');

  await user.click(screen.getByRole('button', { name: 'Mover viewport a 400' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));

  expect(screen.getByTestId('restored-viewport').textContent).toBe('none');
});

test('keeps a frozen teacher roadmap read-only and returns there from preview', async () => {
  const user = userEvent.setup();
  const loadSimulation = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ simulationRoadmap: roadmap, loadSimulation }));
  render(
    <RoadmapCanvas
      identifier={identifier}
      canPreview
      isHistorical
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={1}
    />,
  );

  expect(screen.getByTestId('roadmap-projection').textContent).toBe('teacher');
  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));
  expect(screen.getByTestId('roadmap-projection').textContent).toBe('student');
  await user.click(screen.getByRole('button', { name: 'Volver al roadmap' }));

  expect(screen.getByTestId('roadmap-projection').textContent).toBe('teacher');
  expect(screen.queryByTestId('editor-panel')).toBeNull();
});

test('does not offer completion or reset mutations in a frozen canvas preview', async () => {
  const user = userEvent.setup();
  const completeSimulatedNode = vi.fn();
  const simulationRoadmap = {
    ...roadmap,
    nodes: [
      {
        ...roadmap.nodes[0],
        access: { status: 'ACCESSIBLE' as const },
        isCompleted: false,
        canComplete: true,
      },
    ],
  };
  useRoadmapMock.mockReturnValue(roadmapActions({ simulationRoadmap, completeSimulatedNode }));
  render(
    <RoadmapCanvas
      identifier={identifier}
      canPreview
      isHistorical
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={2}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Previsualizar canvas' }));
  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));

  expect((screen.getByRole('button', { name: 'Completar' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(screen.queryByRole('button', { name: 'Reiniciar progreso' })).toBeNull();
  expect(completeSimulatedNode).not.toHaveBeenCalled();
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
