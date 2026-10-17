import { forwardRef, useImperativeHandle, type ComponentProps, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { RoadmapCanvasSession } from '@/features/roadmap/session';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import { ROADMAP_CHANGE_RECEIVED_EVENT } from '@/features/roadmap/session/change-signal';
import { RoadmapAccessLostError } from '@/features/roadmap/session/access-lost';
import type { NodeEditorProps } from '@/features/roadmap/editor/types';
import type { RoadmapGraphEditingIntent } from '@/features/roadmap/graph/RoadmapGraph';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import { Toaster } from '@/shared/ui/toast';
import { closeToast, findToast, queryToast, queryToasts } from '../../../support/toast';
import { mockViewport } from '../../../support/viewport';

// The public canvas seam renders a mobile sidebar in these scenarios.
beforeEach(() => mockViewport(640));
// The runner cleans up each canvas before these file-scoped globals are restored.
afterAll(() => vi.unstubAllGlobals());

vi.mock('next/dynamic', () => ({
  default: () =>
    forwardRef(function NodeEditorMock({ session, perform, onIntent }: NodeEditorProps, ref) {
      useImperativeHandle(ref, () => ({ guardDraft: vi.fn().mockResolvedValue(true) }), []);
      if (!session.node) return null;
      const node = session.node;
      const resource = node.resources[0];
      const actions: [label: string, run: () => void][] = [
        [
          'Bloquear nodo',
          () => onIntent({ kind: 'change-teacher-block', nodeId: node.id, operation: 'BLOCK' }),
        ],
        node.isVisible
          ? ['Ocultar para estudiantes', () => onIntent({ kind: 'hide-node', nodeId: node.id })]
          : ['Mostrar para estudiantes', () => onIntent({ kind: 'show-node', nodeId: node.id })],
        ['Eliminar nodo', () => onIntent({ kind: 'delete-node', nodeId: node.id })],
        [
          'Guardar cambios',
          () =>
            void perform({
              kind: 'update-node',
              nodeId: node.id,
              value: {
                title: 'Límites y continuidad',
                description: node.description ?? '',
                nodeTypeId: node.nodeTypeId,
              },
            }),
        ],
        [
          'Guardar enlace',
          () =>
            void perform({
              kind: 'add-resource',
              nodeId: node.id,
              resource: {
                title: 'Guía de ejercicios',
                url: 'https://example.test/guia',
                type: 'LINK',
              },
            }),
        ],
        [
          'Subir archivo',
          () =>
            void perform({
              kind: 'upload-resource',
              nodeId: node.id,
              file: new File(['contenido'], 'apuntes.pdf', { type: 'application/pdf' }),
            }),
        ],
      ];
      if (resource) {
        actions.push(
          [
            'Actualizar recurso',
            () =>
              void perform({
                kind: 'update-resource',
                resourceId: resource.id,
                resource: { ...resource, title: 'Guía actualizada' },
              }),
          ],
          [
            'Eliminar recurso',
            () => void perform({ kind: 'delete-resource', resourceId: resource.id }),
          ],
        );
      }
      return (
        <aside>
          {actions.map(([label, run]) => (
            <button key={label} type="button" onClick={run}>
              {label}
            </button>
          ))}
          <output data-testid="session-resource-count">{node.resources.length}</output>
        </aside>
      );
    }),
}));

vi.mock('@/features/roadmap/graph/RoadmapGraph', () => {
  const editingIntents: [label: string, intent: RoadmapGraphEditingIntent][] = [
    [
      'Mover nodo',
      {
        kind: 'move-nodes',
        positions: [{ nodeId: 'node-1', position: { x: 120, y: 80 } }],
      },
    ],
    [
      'Solicitar ordenamiento',
      {
        kind: 'apply-automatic-layout',
        positions: [{ nodeId: 'node-1', position: { x: 320, y: 160 } }],
        direction: 'LR',
      },
    ],
    [
      'Crear dependencia',
      {
        kind: 'create-dependency',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        sourceHandle: 'right',
        targetHandle: 'left',
      },
    ],
    [
      'Eliminar dependencias',
      { kind: 'delete-dependencies', dependencyIds: ['dependency-1', 'dependency-2'] },
    ],
  ];
  return {
    RoadmapGraph: ({
      projection,
      onSelectNode,
      selectedNodeId,
      bottomLeftActions,
      bottomRightActions,
      overlaySlots,
    }: {
      projection: {
        roadmap: {
          nodes: Array<{ id: string; title: string }>;
          dependencies: Array<{ id: string }>;
        };
        kind: 'teaching' | 'student';
        editing?: { onEditingIntent: (intent: unknown) => void };
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
        {projection.kind === 'teaching' && projection.editing
          ? [
              ...editingIntents,
              [
                'Eliminar dependencia',
                {
                  kind: 'delete-dependencies',
                  dependencyIds: projection.roadmap.dependencies.slice(0, 1).map(({ id }) => id),
                } satisfies RoadmapGraphEditingIntent,
              ] as const,
            ].map(([label, intent]) => (
              <button
                key={label}
                type="button"
                onClick={() => projection.editing?.onEditingIntent(intent)}
              >
                {label}
              </button>
            ))
          : null}
      </>
    ),
  };
});

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

const derivativesNode: RoadmapDto['nodes'][number] = {
  id: 'node-2',
  title: 'Derivadas',
  description: null,
  nodeTypeId: 'content',
  positionX: 160,
  positionY: 0,
  isVisible: true,
  isTeacherBlocked: false,
  resources: [],
};

const teachingRoadmap: RoadmapDto = { ...roadmap, nodes: [limitsNode] };

const teacherBlockedRoadmap: RoadmapDto = {
  ...teachingRoadmap,
  nodes: [{ ...limitsNode, isTeacherBlocked: true }, derivativesNode],
};

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

    // Toasts live in the app-level Toaster, so a success outlives the Course offering switch.
    expect(queryToast('Nodo completado.')).toBeTruthy();
    resolvePreviousRoadmap(roadmap);
    expect(await screen.findByRole('button', { name: 'Integrales' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Límites' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Derivadas' })).toBeNull();
  });

  test('student and observer sessions retain their Roadmap on changes and recovery until re-entry', async () => {
    // Observers use the same student experience at the public canvas seam.
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

  test('routes current teaching Node and Resource edits through the public session', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    renderSession(persistence);

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }));
    expect(await findToast('Cambios guardados exitosamente.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Guardar enlace' }));
    expect(await findToast('Enlace guardado exitosamente.')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Actualizar recurso' }));
    // Successes stack, so the second save adds a second toast with the same message.
    await waitFor(() => expect(queryToasts('Enlace guardado exitosamente.')).toHaveLength(2));
    await user.click(await screen.findByRole('button', { name: 'Eliminar recurso' }));
    await user.click(screen.getByRole('button', { name: 'Subir archivo' }));
    expect(await findToast('Recurso guardado exitosamente.')).toBeTruthy();

    const saved = await persistence.load(teachingInput);
    expect(saved.nodes[0]).toMatchObject({ title: 'Límites y continuidad' });
    expect(saved.nodes[0]).toHaveProperty('resources', [
      { id: expect.any(String), title: 'apuntes.pdf', url: 'apuntes.pdf', type: 'FILE' },
    ]);
  });

  test('routes construction through the public session and persists the confirmed layout', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
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

    await user.click(screen.getByRole('button', { name: 'Mover nodo' }));
    await waitFor(async () => {
      const saved = await persistence.load(teachingInput);
      expect(saved.nodes[0]).toMatchObject({ positionX: 120, positionY: 80 });
    });

    await user.click(screen.getByRole('button', { name: 'Solicitar ordenamiento' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar ordenamiento' });
    await user.click(within(dialog).getByRole('button', { name: 'Ordenar nodos' }));
    await waitFor(async () => {
      const saved = await persistence.load(teachingInput);
      expect(saved.nodes[0]).toMatchObject({ positionX: 320, positionY: 160 });
    });
  });

  test('confirms a Node type deletion through the public session', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    await persistence.addNodeType(teachingInput, {
      name: 'Taller',
      icon: 'Shapes',
      color: '#024AD8',
    });
    renderSession(persistence);

    await user.click(await screen.findByRole('button', { name: 'Crear en el mapa' }));
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

  test('routes Dependency creation and deletion through the public session', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence({
      ...teachingRoadmap,
      nodes: [limitsNode, derivativesNode],
    });
    renderSession(persistence);

    await user.click(await screen.findByRole('button', { name: 'Crear dependencia' }));
    expect(await findToast('Dependencia creada exitosamente.')).toBeTruthy();
    expect((await persistence.load(teachingInput)).dependencies).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Eliminar dependencia' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar eliminación' });
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    expect(await findToast('Dependencia eliminada exitosamente.')).toBeTruthy();
    await waitFor(async () =>
      expect((await persistence.load(teachingInput)).dependencies).toEqual([]),
    );
  });

  test('routes Node visibility and deletion through one public session confirmation', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    renderSession(persistence);

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    const deleteNodeButton = screen.getByRole('button', { name: 'Eliminar nodo' });
    const layoutButton = screen.getByRole('button', { name: 'Solicitar ordenamiento' });
    await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
    const visibilityDialog = await screen.findByRole('alertdialog', {
      name: '¿Ocultar “Límites”?',
    });

    // No other Confirmed action, Node deletion or automatic layout, can open beside it.
    fireEvent.click(deleteNodeButton);
    fireEvent.click(layoutButton);
    await act(() => Promise.resolve());
    expect(screen.getAllByRole('alertdialog')).toEqual([visibilityDialog]);

    await user.click(within(visibilityDialog).getByRole('button', { name: 'Ocultar' }));
    await waitFor(async () =>
      expect((await persistence.load(teachingInput)).nodes[0]).toMatchObject({ isVisible: false }),
    );

    await user.click(await screen.findByRole('button', { name: 'Mostrar para estudiantes' }));
    const showDialog = await screen.findByRole('alertdialog', { name: '¿Mostrar “Límites”?' });
    await user.click(within(showDialog).getByRole('button', { name: 'Mostrar' }));
    await waitFor(async () =>
      expect((await persistence.load(teachingInput)).nodes[0]).toMatchObject({ isVisible: true }),
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar nodo' }));
    const deletionDialog = await screen.findByRole('alertdialog', {
      name: '¿Eliminar “Límites”?',
    });
    await user.click(within(deletionDialog).getByRole('button', { name: 'Eliminar nodo' }));
    await waitFor(async () => expect((await persistence.load(teachingInput)).nodes).toEqual([]));
  });

  test('routes Teacher block through the public session', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    renderSession(persistence);

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    await user.click(screen.getByRole('button', { name: 'Bloquear nodo' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Bloquear “Límites”?' });
    await user.click(within(dialog).getByRole('button', { name: 'Bloquear nodo' }));

    await waitFor(async () =>
      expect((await persistence.load(teachingInput)).nodes[0]).toMatchObject({
        isTeacherBlocked: true,
      }),
    );
  });

  test('confirms an impacted Dependency creation through the public session', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teacherBlockedRoadmap);
    renderSession(persistence);

    await user.click(await screen.findByRole('button', { name: 'Crear dependencia' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo' });
    expect(dialog.textContent).toContain('Derivadas');
    expect((await persistence.load(teachingInput)).dependencies).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Conectar y bloquear' }));
    expect(await findToast('Dependencia creada exitosamente.')).toBeTruthy();
    expect((await persistence.load(teachingInput)).nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'node-2', isTeacherBlocked: true })]),
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
