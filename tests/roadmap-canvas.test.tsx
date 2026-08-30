import { type ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import RoadmapCanvas from '../src/features/roadmap/RoadmapCanvas';

const { useRoadmapMock } = vi.hoisted(() => ({ useRoadmapMock: vi.fn() }));

vi.mock('next/dynamic', () => ({ default: () => () => null }));

vi.mock('@/features/roadmap/graph/RoadmapGraph', () => ({
  RoadmapGraph: ({
    onDeleteDependencies,
    onToggleNodeVisibility,
    onAutoLayout,
    topRightActions,
  }: {
    onDeleteDependencies: (ids: string[]) => void;
    onToggleNodeVisibility: (nodeId: string, isVisible: boolean) => void;
    onAutoLayout: (nodes: { id: string; position: { x: number; y: number } }[]) => void;
    topRightActions?: ReactNode;
  }) => (
    <>
      {topRightActions}
      <button type="button" onClick={() => onDeleteDependencies(['dependency-1', 'dependency-2'])}>
        Solicitar eliminación de dependencias
      </button>
      <button type="button" onClick={() => onToggleNodeVisibility('node-1', false)}>
        Ocultar para estudiantes
      </button>
      <button
        type="button"
        onClick={() => onAutoLayout([{ id: 'node-1', position: { x: 40, y: 80 } }])}
      >
        Ordenar mapa
      </button>
    </>
  ),
}));

vi.mock('@/features/roadmap/student/NodeDetail', () => ({
  StudentNodeDetail: () => null,
}));

vi.mock('@/features/roadmap/useRoadmap', () => ({ useRoadmap: useRoadmapMock }));

const roadmap = {
  course: { code: 'CC1001', name: 'Programación I', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [{ id: 'content', name: 'Contenido', color: '#024AD8', isPredefined: true }],
  nodes: [],
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
    deleteDependency: vi.fn(),
    toggleVisibility: vi.fn(),
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
  expect(screen.getByRole('region', { name: 'Leyenda del roadmap' }).textContent).toContain(
    'TiposContenido',
  );
  expect(
    screen.getByText(/Arrastra desde un punto de un nodo a otro para crear una dependencia/),
  ).toBeTruthy();
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
  const addNode = vi.fn().mockResolvedValue(true);
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

  expect(addNode).toHaveBeenCalledWith({
    title: 'Repasar límites',
    description: '',
    nodeTypeId: 'content',
    isVisible: true,
  });
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
  await user.click(within(dialog).getByRole('button', { name: 'Crear tipo' }));

  expect(addNodeType).toHaveBeenCalledWith({ name: 'Laboratorio', color: '#024ad8' });
  expect(screen.getByRole('dialog', { name: 'Tipos de nodo' })).toBeTruthy();

  const customType = { id: 'lab', name: 'Laboratorio', color: '#024ad8', isPredefined: false };
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
    color: '#024ad8',
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
  expect(screen.getByRole('alertdialog', { name: 'Confirmar eliminación' }).textContent).toContain(
    'Eliminarás estas dependencias. Esta acción no se puede deshacer.',
  );

  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(deleteDependency).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminación de dependencias' }));
  await user.click(screen.getByRole('button', { name: 'Eliminar' }));
  expect(deleteDependency).toHaveBeenNthCalledWith(1, 'dependency-1');
  expect(deleteDependency).toHaveBeenNthCalledWith(2, 'dependency-2');
});

test('connects the node visibility action to the roadmap mutation', async () => {
  const user = userEvent.setup();
  const toggleVisibility = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ toggleVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
  expect(toggleVisibility).toHaveBeenCalledWith('node-1', false);
});

test('persists every repositioned node after ordering the map', async () => {
  const user = userEvent.setup();
  const moveNode = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ moveNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Ordenar mapa' }));
  expect(moveNode).toHaveBeenCalledWith('node-1', { x: 40, y: 80 });
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
