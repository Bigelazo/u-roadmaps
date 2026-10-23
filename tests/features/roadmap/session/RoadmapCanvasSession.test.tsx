import type { ComponentProps, ReactNode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { RoadmapCanvasSession } from '@/features/roadmap/session';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import { ROADMAP_CHANGE_RECEIVED_EVENT } from '@/features/roadmap/session/change-signal';
import { RoadmapAccessLostError } from '@/features/roadmap/session/access-lost';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import { Toaster } from '@/shared/ui/toast';
import { closeToast, findToast, queryToast } from '../../../support/toast';
import { mockViewport } from '../../../support/viewport';

beforeEach(() => mockViewport(640));
afterAll(() => vi.unstubAllGlobals());

vi.mock('next/dynamic', () => ({ default: () => () => null }));

vi.mock('@/features/roadmap/graph/RoadmapGraph', () => ({
  RoadmapGraph: ({
    projection,
    onSelectNode,
    selectedNodeId,
    bottomLeftActions,
    bottomRightActions,
    overlaySlots,
  }: {
    projection: {
      roadmap: { nodes: Array<{ id: string; title: string }> };
      editing?: unknown;
    };
    onSelectNode: (nodeId: string) => void;
    selectedNodeId?: string | null;
    bottomLeftActions?: (
      findOpenPosition: (title: string) => { x: number; y: number } | null,
    ) => ReactNode;
    bottomRightActions?: (
      findOpenPosition: (title: string) => { x: number; y: number } | null,
    ) => ReactNode;
    overlaySlots?: { topCenter?: ReactNode };
  }) => (
    <>
      {bottomLeftActions?.(() => ({ x: 480, y: 240 }))}
      {bottomRightActions?.(() => ({ x: 480, y: 240 }))}
      <div data-testid="roadmap-overlay-top-center">{overlaySlots?.topCenter}</div>
      <output data-testid="selected-node-id">{selectedNodeId ?? ''}</output>
      <output data-testid="roadmap-mode">{projection.editing ? 'editing' : 'student'}</output>
      {projection.roadmap.nodes[0] ? (
        <button type="button" onClick={() => onSelectNode(projection.roadmap.nodes[0].id)}>
          {projection.roadmap.nodes[0].title}
        </button>
      ) : null}
    </>
  ),
}));

vi.mock('@/features/roadmap/student/NodeDetail', () => ({
  StudentNodeDetail: ({
    node,
    onComplete,
    isReadOnly,
  }: {
    node?: { id: string; title: string };
    onComplete: (node: { id: string }) => void;
    isReadOnly?: boolean;
  }) =>
    node ? (
      <button type="button" disabled={isReadOnly} onClick={() => onComplete(node)}>
        Completar {node.title}
      </button>
    ) : null,
}));

type SessionInput = ComponentProps<typeof RoadmapCanvasSession>;
type SessionPersistence = ComponentProps<
  typeof RoadmapCanvasSessionPersistenceProvider
>['persistence'];

const roadmap: StudentRoadmapDto = {
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
      nodeTypeId: 'content',
      positionX: 0,
      positionY: 0,
      isVisible: true as const,
      access: { status: 'ACCESSIBLE' as const },
      description: null,
      isCompleted: false,
      canComplete: true,
      resources: [],
    },
  ],
  dependencies: [],
};

const limitsNode: RoadmapDto['nodes'][number] = {
  id: 'node-1',
  title: 'Límites',
  description: 'Información guardada',
  nodeTypeId: 'content',
  positionX: 0,
  positionY: 0,
  isVisible: true,
  isTeacherBlocked: false,
  resources: [],
};

const teachingRoadmap: RoadmapDto = { ...roadmap, nodes: [limitsNode] };

function courseInput(courseCode = 'CC1001', title = 'Programación I') {
  return { identifier: { courseCode, year: 2026, semester: 2 }, title };
}

const teachingInput = {
  courseOffering: courseInput(),
  experience: { kind: 'teaching' as const, term: 'current' as const },
};

function studentInput(
  term: 'current' | 'historical' = 'current',
  courseOffering = courseInput(),
): SessionInput {
  return { courseOffering, experience: { kind: 'student', term } };
}

function renderSession(persistence: SessionPersistence, input: SessionInput = teachingInput) {
  const view = (next: SessionInput) => (
    <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
      <RoadmapCanvasSession {...next} />
      <Toaster />
    </RoadmapCanvasSessionPersistenceProvider>
  );
  const utils = render(view(input));
  return { ...utils, rerenderSession: (next: SessionInput) => utils.rerender(view(next)) };
}

function signalChange(detail: object) {
  window.dispatchEvent(new CustomEvent(ROADMAP_CHANGE_RECEIVED_EVENT, { detail }));
}

describe('RoadmapCanvasSession', () => {
  test('loads a student offering from its in-memory persistence seam and records a completion', async () => {
    const user = userEvent.setup();
    renderSession(createInMemoryRoadmapSessionPersistence(roadmap), studentInput());

    const node = await screen.findByRole('button', { name: 'Límites' });
    await user.click(node);
    const complete = await screen.findByRole('button', { name: 'Completar Límites' });
    await user.click(complete);
    expect(await findToast('Nodo completado.')).not.toBeNull();
  });

  test('keeps app-level success toasts and ignores a delayed response when the Course offering changes', async () => {
    const user = userEvent.setup();
    let resolvePreviousRoadmap!: (value: StudentRoadmapDto) => void;
    const previousRoadmap = new Promise<StudentRoadmapDto>((resolve) => {
      resolvePreviousRoadmap = resolve;
    });
    const nextRoadmap: StudentRoadmapDto = {
      ...roadmap,
      nodes: [{ ...roadmap.nodes[0], title: 'Derivadas' }],
    };
    const finalRoadmap: StudentRoadmapDto = {
      ...roadmap,
      nodes: [{ ...roadmap.nodes[0], title: 'Integrales' }],
    };
    const persistence = {
      ...createInMemoryRoadmapSessionPersistence(roadmap),
      load: vi.fn(
        ({ courseOffering }: { courseOffering: { identifier: { courseCode: string } } }) =>
          courseOffering.identifier.courseCode === 'CC1001'
            ? previousRoadmap
            : Promise.resolve(
                courseOffering.identifier.courseCode === 'CC1002' ? nextRoadmap : finalRoadmap,
              ),
      ),
      complete: vi.fn().mockResolvedValue(undefined),
    };
    const { rerenderSession } = renderSession(persistence, studentInput());

    await waitFor(() => expect(persistence.load).toHaveBeenCalledTimes(1));

    rerenderSession(studentInput('current', courseInput('CC1002', 'Cálculo I')));

    await user.click(await screen.findByRole('button', { name: 'Derivadas' }));
    await user.click(screen.getByRole('button', { name: 'Completar Derivadas' }));
    expect(await findToast('Nodo completado.')).toBeTruthy();

    rerenderSession(studentInput('current', courseInput('CC1003', 'Álgebra I')));

    expect(queryToast('Nodo completado.')).toBeTruthy();
    resolvePreviousRoadmap(roadmap);
    expect(await screen.findByRole('button', { name: 'Integrales' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Límites' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Derivadas' })).toBeNull();
  });

  test('student and observer sessions retain their Roadmap on changes and recovery until re-entry', async () => {
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    const load = vi.spyOn(persistence, 'load');
    const input = studentInput();
    const { unmount } = renderSession(persistence, input);
    await screen.findByRole('button', { name: 'Límites' });
    load.mockResolvedValue({
      ...roadmap,
      nodes: [{ ...roadmap.nodes[0], title: 'Cambio remoto' }],
    });
    await act(async () => {
      signalChange(input.courseOffering.identifier);
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('u-roadmaps:roadmap-recovery'));
    });
    expect(screen.getByRole('button', { name: 'Límites' })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
    unmount();
    renderSession(persistence, input);
    await screen.findByRole('button', { name: 'Cambio remoto' });
  });

  test('same-Roadmap re-entry loads current content when its opening changes', async () => {
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    const load = vi.spyOn(persistence, 'load');
    const { rerenderSession } = renderSession(persistence, {
      ...studentInput(),
      roadmapEntryKey: 'first-entry',
    });
    await screen.findByRole('button', { name: 'Límites' });
    load.mockResolvedValue({
      ...roadmap,
      nodes: [{ ...roadmap.nodes[0], title: 'Cambio remoto' }],
    });
    rerenderSession({ ...studentInput(), roadmapEntryKey: 'notice-entry' });
    expect(await screen.findByRole('button', { name: 'Cambio remoto' })).toBeTruthy();
  });

  test('students can retry an initial HTTP failure without enabling live reloads', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    vi.spyOn(persistence, 'load').mockRejectedValueOnce(new Error('Fallo inicial'));
    renderSession(persistence, studentInput());
    await screen.findByText('Fallo inicial');
    await user.click(screen.getByRole('button', { name: 'Reintentar actualización' }));
    expect(await screen.findByRole('button', { name: 'Límites' })).toBeTruthy();
  });

  test('an access invalidation removes student content after authoritative HTTP denial', async () => {
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    const load = vi.spyOn(persistence, 'load');
    renderSession(persistence, studentInput());
    await screen.findByRole('button', { name: 'Límites' });
    load.mockRejectedValue(new RoadmapAccessLostError('Acceso revocado'));
    await act(async () => {
      signalChange({ ...teachingInput.courseOffering.identifier, accessLost: true });
    });
    expect(screen.queryByRole('button', { name: 'Límites' })).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('ignores unrelated signals and an older Roadmap refetch that finishes last', async () => {
    let resolveOlder!: (value: RoadmapDto) => void;
    let resolveLatest!: (value: RoadmapDto) => void;
    const older = new Promise<RoadmapDto>((resolve) => {
      resolveOlder = resolve;
    });
    const latest = new Promise<RoadmapDto>((resolve) => {
      resolveLatest = resolve;
    });
    let loadCount = 0;
    const persistence = {
      ...createInMemoryRoadmapSessionPersistence(roadmap),
      load: vi.fn(() => {
        loadCount += 1;
        return loadCount === 1
          ? Promise.resolve(teachingRoadmap)
          : loadCount === 2
            ? older
            : latest;
      }),
      complete: vi.fn().mockResolvedValue(undefined),
    };
    renderSession(persistence);
    await screen.findByRole('button', { name: 'Límites' });

    act(() => {
      signalChange({ courseCode: 'CC1002', year: 2026, semester: 2 });
    });
    expect(persistence.load).toHaveBeenCalledTimes(1);

    act(() => {
      for (let index = 0; index < 2; index += 1) {
        signalChange({ courseCode: 'CC1001', year: 2026, semester: 2 });
      }
    });
    await waitFor(() => expect(persistence.load).toHaveBeenCalledTimes(3));
    await act(async () => {
      resolveLatest({
        ...teachingRoadmap,
        nodes: [{ ...teachingRoadmap.nodes[0], title: 'Integrales' }],
      });
      await latest;
    });
    await screen.findByRole('button', { name: 'Integrales' });
    await act(async () => {
      resolveOlder({
        ...teachingRoadmap,
        nodes: [{ ...teachingRoadmap.nodes[0], title: 'Derivadas' }],
      });
      await older;
    });
    expect(screen.getByRole('button', { name: 'Integrales' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Derivadas' })).toBeNull();
  });

  test('runs a historical student experience through the public session as read-only', async () => {
    const user = userEvent.setup();
    renderSession(createInMemoryRoadmapSessionPersistence(roadmap), studentInput('historical'));

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    expect(
      (screen.getByRole('button', { name: 'Completar Límites' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test('keeps the loaded offering visible after a later completion failure and lets the student dismiss it', async () => {
    const user = userEvent.setup();
    const persistence = {
      ...createInMemoryRoadmapSessionPersistence(roadmap),
      load: vi.fn().mockResolvedValue(roadmap),
      complete: vi.fn().mockRejectedValue(new Error('No se pudo completar el nodo.')),
    };
    renderSession(persistence, studentInput());

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    await user.click(await screen.findByRole('button', { name: 'Completar Límites' }));
    expect(await findToast('No se pudo completar el nodo.')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Límites' })).not.toBeNull();
    await closeToast(user, await findToast('No se pudo completar el nodo.'));
    await waitFor(() => expect(queryToast('No se pudo completar el nodo.')).toBeNull());
    expect(screen.getByRole('button', { name: 'Límites' })).not.toBeNull();
  });

  test('routes current teaching Canvas preview through the session and isolates simulated Completions', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    renderSession(persistence);

    await user.click(await screen.findByRole('button', { name: 'Vista estudiante' }));
    expect(await screen.findByText('Previsualización del canvas')).toBeTruthy();
    expect(screen.getByTestId('roadmap-mode').textContent).toBe('student');
    expect(screen.getByTestId('selected-node-id').textContent).toBe('');

    await user.click(screen.getByRole('button', { name: 'Límites' }));
    await user.click(screen.getByRole('button', { name: 'Completar Límites' }));
    await waitFor(async () =>
      expect((await persistence.loadSimulation(teachingInput)).nodes[0]).toMatchObject({
        isCompleted: true,
      }),
    );
    expect((await persistence.load(teachingInput)).nodes[0]).not.toHaveProperty('isCompleted');

    await user.click(screen.getByRole('button', { name: 'Reiniciar progreso' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Reiniciar progreso de previsualización',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Reiniciar progreso' }));
    await waitFor(async () =>
      expect((await persistence.loadSimulation(teachingInput)).nodes[0]).toMatchObject({
        isCompleted: false,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Ir al editor' }));
    expect(screen.queryByText('Previsualización del canvas')).toBeNull();
  });

  test('keeps historical teaching Canvas preview read-only through the session', async () => {
    const user = userEvent.setup();
    renderSession(createInMemoryRoadmapSessionPersistence(teachingRoadmap), {
      courseOffering: teachingInput.courseOffering,
      experience: { kind: 'teaching', term: 'historical' },
    });

    await user.click(await screen.findByRole('button', { name: 'Vista estudiante' }));
    expect(await screen.findByText('Previsualización del canvas')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver al roadmap' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reiniciar progreso' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Límites' }));
    expect(
      (screen.getByRole('button', { name: 'Completar Límites' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Volver al roadmap' }));
    expect(screen.queryByText('Previsualización del canvas')).toBeNull();
  });

  test('routes the Node creator through the public session and selects the created Node', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    await persistence.addNodeType(teachingInput, {
      name: 'Taller',
      icon: 'Shapes',
      color: '#024AD8',
    });
    renderSession(persistence);

    await user.click(await screen.findByRole('button', { name: 'Crear en el mapa' }));
    await user.click(await screen.findByText('Crear nodo'));
    await user.type(screen.getByLabelText('Título'), 'Derivadas');
    await user.click(screen.getByRole('button', { name: 'Agregar nodo' }));
    await waitFor(async () => {
      const created = (await persistence.load(teachingInput)).nodes.find(
        ({ title }) => title === 'Derivadas',
      );
      expect(screen.getByTestId('selected-node-id').textContent).toBe(created?.id);
    });

    await user.click(screen.getByRole('button', { name: 'Crear en el mapa' }));
    await user.click(await screen.findByText('Tipos de nodo'));
    await user.click(await screen.findByRole('button', { name: 'Eliminar tipo Taller' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar eliminación' });
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    await waitFor(async () =>
      expect((await persistence.load(teachingInput)).nodeTypes.map(({ name }) => name)).toEqual([
        'Contenido',
      ]),
    );
  });
});

test('current teaching sessions recover missed changes and retain the last projection on transient failure', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
  const load = vi.spyOn(persistence, 'load');
  renderSession(persistence);
  await screen.findByRole('button', { name: 'Límites' });
  await persistence.updateNode(teachingInput, 'node-1', {
    title: 'Cambio remoto',
    description: '',
    nodeTypeId: teachingRoadmap.nodes[0].nodeTypeId,
  });
  act(() => window.dispatchEvent(new Event('online')));
  await screen.findByRole('button', { name: 'Cambio remoto' });
  load.mockRejectedValueOnce(new Error('Fallo transitorio'));
  act(() => window.dispatchEvent(new Event('online')));
  await findToast('Fallo transitorio');
  expect(screen.getByRole('button', { name: 'Cambio remoto' })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar actualización' }));
  await waitFor(() => expect(queryToast('Fallo transitorio')).toBeNull());
});
