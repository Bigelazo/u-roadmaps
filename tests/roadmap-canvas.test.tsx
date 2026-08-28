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
  }: {
    onDeleteDependencies: (ids: string[]) => void;
    onToggleNodeVisibility: (nodeId: string, isVisible: boolean) => void;
  }) => (
    <>
      <button type="button" onClick={() => onDeleteDependencies(['dependency-1', 'dependency-2'])}>
        Solicitar eliminación de dependencias
      </button>
      <button type="button" onClick={() => onToggleNodeVisibility('node-1', false)}>
        Ocultar para estudiantes
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

test('separates the course context, term, and teacher state in the canvas header', () => {
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  expect(screen.getByRole('heading', { name: 'Programación I' })).toBeTruthy();
  expect(screen.getByText('CC1001')).toBeTruthy();
  expect(screen.getByText('2026, semestre 2')).toBeTruthy();
  expect(screen.getByText('Modo edición')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Leyenda del roadmap' }).textContent).toContain(
    'TiposContenido',
  );
  expect(
    screen.getByText(/Arrastra desde un punto de un nodo a otro para crear una dependencia/),
  ).toBeTruthy();
});

test('creates nodes from the floating canvas button', async () => {
  const user = userEvent.setup();
  const addNode = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ addNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Agregar nodo' }));
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
