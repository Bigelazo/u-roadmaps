import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { RoadmapCanvasSession } from '@/features/roadmap/session';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import { ROADMAP_CHANGE_RECEIVED_EVENT } from '@/features/roadmap/session/change-signal';
import { RoadmapAccessLostError } from '@/features/roadmap/session/access-lost';
import type { NodeEditorProps } from '@/features/roadmap/editor/types';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';

// The public canvas seam renders a mobile sidebar in these scenarios.
beforeEach(() => {
  vi.stubGlobal('innerWidth', 640);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(max-width: 767px)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }));
});
// The runner cleans up each canvas before these file-scoped globals are restored.
afterAll(() => vi.unstubAllGlobals());

vi.mock('next/dynamic', () => ({
  default: () =>
    forwardRef(function NodeEditorMock({ session, perform, onIntent }: NodeEditorProps, ref) {
      useImperativeHandle(ref, () => ({ guardDraft: vi.fn().mockResolvedValue(true) }), []);
      if (!session.node) return null;
      const resource = session.node.resources[0];
      return (
        <aside>
          <button
            type="button"
            onClick={() =>
              onIntent({
                kind: 'change-teacher-block',
                nodeId: session.node!.id,
                operation: 'BLOCK',
              })
            }
          >
            Bloquear rama
          </button>
          <button
            type="button"
            onClick={() =>
              onIntent({
                kind: 'change-visibility',
                nodeId: session.node!.id,
                isVisible: true,
              })
            }
          >
            Ocultar para estudiantes
          </button>
          <button
            type="button"
            onClick={() => onIntent({ kind: 'delete-node', nodeId: session.node!.id })}
          >
            Eliminar nodo
          </button>
          <button
            type="button"
            onClick={() =>
              void perform({
                kind: 'update-node',
                nodeId: session.node!.id,
                value: {
                  title: 'Límites y continuidad',
                  description: session.node!.description ?? '',
                  nodeTypeId: session.node!.nodeTypeId,
                },
              })
            }
          >
            Guardar cambios
          </button>
          <button
            type="button"
            onClick={() =>
              void perform({
                kind: 'add-resource',
                nodeId: session.node!.id,
                resource: {
                  title: 'Guía de ejercicios',
                  url: 'https://example.test/guia',
                  type: 'LINK',
                },
              })
            }
          >
            Guardar enlace
          </button>
          <button
            type="button"
            onClick={() =>
              void perform({
                kind: 'upload-resource',
                nodeId: session.node!.id,
                file: new File(['contenido'], 'apuntes.pdf', { type: 'application/pdf' }),
              })
            }
          >
            Subir archivo
          </button>
          {resource ? (
            <>
              <button
                type="button"
                onClick={() =>
                  void perform({
                    kind: 'update-resource',
                    resourceId: resource.id,
                    resource: { ...resource, title: 'Guía actualizada' },
                  })
                }
              >
                Actualizar recurso
              </button>
              <button
                type="button"
                onClick={() => void perform({ kind: 'delete-resource', resourceId: resource.id })}
              >
                Eliminar recurso
              </button>
            </>
          ) : null}
          <output data-testid="session-resource-count">{session.node.resources.length}</output>
        </aside>
      );
    }),
}));

vi.mock('@/features/roadmap/graph/RoadmapGraph', () => ({
  RoadmapGraph: ({
    projection,
    onSelectNode,
    selectedNodeId,
    topRightActions,
    bottomRightActions,
    overlaySlots,
  }: {
    projection: {
      roadmap: { nodes: Array<{ id: string; title: string }> };
      kind: 'teaching' | 'student';
      editing?: { onEditingIntent: (intent: unknown) => void };
    };
    onSelectNode: (nodeId: string) => void;
    selectedNodeId?: string | null;
    topRightActions?: (
      findOpenPosition: (title: string) => { x: number; y: number } | null,
    ) => ReactNode;
    bottomRightActions?: (
      findOpenPosition: (title: string) => { x: number; y: number } | null,
    ) => ReactNode;
    overlaySlots?: { topCenter?: ReactNode };
  }) => (
    <>
      {topRightActions?.(() => ({ x: 480, y: 240 }))}
      {bottomRightActions?.(() => ({ x: 480, y: 240 }))}
      <div data-testid="roadmap-overlay-top-center">{overlaySlots?.topCenter}</div>
      <output data-testid="selected-node-id">{selectedNodeId ?? ''}</output>
      <output data-testid="roadmap-mode">{projection.editing ? 'editing' : 'student'}</output>
      {projection.roadmap.nodes[0] ? (
        <button type="button" onClick={() => onSelectNode(projection.roadmap.nodes[0].id)}>
          {projection.roadmap.nodes[0].title}
        </button>
      ) : null}
      {projection.kind === 'teaching' && projection.editing ? (
        <>
          <button
            type="button"
            onClick={() =>
              projection.editing?.onEditingIntent({
                kind: 'node-positions',
                cause: 'pointer',
                positions: [{ nodeId: 'node-1', position: { x: 120, y: 80 } }],
              })
            }
          >
            Mover nodo
          </button>
          <button
            type="button"
            onClick={() =>
              projection.editing?.onEditingIntent({
                kind: 'request-automatic-layout',
                positions: [{ nodeId: 'node-1', position: { x: 320, y: 160 } }],
                direction: 'LR',
              })
            }
          >
            Solicitar ordenamiento
          </button>
          <button
            type="button"
            onClick={() =>
              projection.editing?.onEditingIntent({
                kind: 'create-dependency',
                sourceNodeId: 'node-1',
                targetNodeId: 'node-2',
                sourceHandle: 'right',
                targetHandle: 'left',
              })
            }
          >
            Crear dependencia
          </button>
          <button
            type="button"
            onClick={() =>
              projection.editing?.onEditingIntent({
                kind: 'delete-dependencies',
                dependencyIds: ['dependency-1'],
              })
            }
          >
            Eliminar dependencia
          </button>
          <button
            type="button"
            onClick={() =>
              projection.editing?.onEditingIntent({
                kind: 'delete-dependencies',
                dependencyIds: ['dependency-1', 'dependency-2'],
              })
            }
          >
            Eliminar dependencias
          </button>
        </>
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

const teachingRoadmap: RoadmapDto = {
  ...roadmap,
  nodes: [
    {
      id: 'node-1',
      title: 'Límites',
      description: 'Información guardada',
      nodeTypeId: 'content',
      positionX: 0,
      positionY: 0,
      isVisible: true,
      isTeacherBlocked: false,
      resources: [],
    },
  ],
};

const teacherBlockedRoadmap: RoadmapDto = {
  ...teachingRoadmap,
  nodes: [
    {
      id: 'node-1',
      title: 'Límites',
      description: 'Información guardada',
      nodeTypeId: 'content',
      positionX: 0,
      positionY: 0,
      isVisible: true,
      isTeacherBlocked: true,
      resources: [],
    },
    {
      id: 'node-2',
      title: 'Derivadas',
      description: null,
      nodeTypeId: 'content',
      positionX: 160,
      positionY: 0,
      isVisible: true,
      isTeacherBlocked: false,
      resources: [],
    },
  ],
};

const twoDependenciesRoadmap: RoadmapDto = {
  ...teacherBlockedRoadmap,
  dependencies: [
    {
      id: 'dependency-1',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
      sourceHandle: 'right',
      targetHandle: 'left',
    },
    {
      id: 'dependency-2',
      sourceNodeId: 'node-2',
      targetNodeId: 'node-1',
      sourceHandle: 'right',
      targetHandle: 'left',
    },
  ],
};

const teachingInput = {
  courseOffering: {
    identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
    title: 'Programación I',
  },
  experience: { kind: 'teaching' as const, term: 'current' as const },
};

describe('RoadmapCanvasSession', () => {
  test('loads a student offering from its in-memory persistence seam and records a completion', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession
          courseOffering={{
            identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
            title: 'Programación I',
          }}
          experience={{ kind: 'student', term: 'current' }}
        />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    const node = await screen.findByRole('button', { name: 'Límites' });
    await user.click(node);
    const complete = await screen.findByRole('button', { name: 'Completar Límites' });
    await user.click(complete);
    expect(await screen.findByRole('status', { name: 'Nodo completado.' })).not.toBeNull();
  });

  test('resets feedback and ignores a delayed response when the Course offering changes', async () => {
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
    const { rerender } = render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession
          courseOffering={{
            identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
            title: 'Programación I',
          }}
          experience={{ kind: 'student', term: 'current' }}
        />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await waitFor(() => expect(persistence.load).toHaveBeenCalledTimes(1));

    rerender(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession
          courseOffering={{
            identifier: { courseCode: 'CC1002', year: 2026, semester: 2 },
            title: 'Cálculo I',
          }}
          experience={{ kind: 'student', term: 'current' }}
        />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Derivadas' }));
    await user.click(screen.getByRole('button', { name: 'Completar Derivadas' }));
    expect(await screen.findByRole('status', { name: 'Nodo completado.' })).toBeTruthy();

    rerender(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession
          courseOffering={{
            identifier: { courseCode: 'CC1003', year: 2026, semester: 2 },
            title: 'Álgebra I',
          }}
          experience={{ kind: 'student', term: 'current' }}
        />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    expect(screen.queryByRole('status', { name: 'Nodo completado.' })).toBeNull();
    resolvePreviousRoadmap(roadmap);
    expect(await screen.findByRole('button', { name: 'Integrales' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Límites' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Derivadas' })).toBeNull();
  });

  test('student and observer sessions retain their Roadmap on changes and recovery until re-entry', async () => {
    // Observers use the same student experience at the public canvas seam.
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    const load = vi.spyOn(persistence, 'load');
    const input = {
      ...teachingInput,
      experience: { kind: 'student' as const, term: 'current' as const },
    };
    const { unmount } = render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...input} />
      </RoadmapCanvasSessionPersistenceProvider>,
    );
    await screen.findByRole('button', { name: 'Límites' });
    load.mockResolvedValue({
      ...roadmap,
      nodes: [{ ...roadmap.nodes[0], title: 'Cambio remoto' }],
    });
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(ROADMAP_CHANGE_RECEIVED_EVENT, {
          detail: input.courseOffering.identifier,
        }),
      );
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('u-roadmaps:roadmap-recovery'));
    });
    expect(screen.getByRole('button', { name: 'Límites' })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
    unmount();
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...input} />
      </RoadmapCanvasSessionPersistenceProvider>,
    );
    await screen.findByRole('button', { name: 'Cambio remoto' });
  });

  test('same-Roadmap re-entry loads current content when its opening changes', async () => {
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    const load = vi.spyOn(persistence, 'load');
    const input = {
      ...teachingInput,
      experience: { kind: 'student' as const, term: 'current' as const },
    };
    const view = (opening: string) => (
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...input} notificationOpeningId={opening} />
      </RoadmapCanvasSessionPersistenceProvider>
    );
    const { rerender } = render(view('first-entry'));
    await screen.findByRole('button', { name: 'Límites' });
    load.mockResolvedValue({
      ...roadmap,
      nodes: [{ ...roadmap.nodes[0], title: 'Cambio remoto' }],
    });
    rerender(view('notice-entry'));
    expect(await screen.findByRole('button', { name: 'Cambio remoto' })).toBeTruthy();
  });

  test('students can retry an initial HTTP failure without enabling live reloads', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    vi.spyOn(persistence, 'load').mockRejectedValueOnce(new Error('Fallo inicial'));
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession
          {...teachingInput}
          experience={{ kind: 'student', term: 'current' }}
        />
      </RoadmapCanvasSessionPersistenceProvider>,
    );
    await screen.findByText('Fallo inicial');
    await user.click(screen.getByRole('button', { name: 'Reintentar actualización' }));
    expect(await screen.findByRole('button', { name: 'Límites' })).toBeTruthy();
  });

  test('an access invalidation removes student content after authoritative HTTP denial', async () => {
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    const load = vi.spyOn(persistence, 'load');
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession
          {...teachingInput}
          experience={{ kind: 'student', term: 'current' }}
        />
      </RoadmapCanvasSessionPersistenceProvider>,
    );
    await screen.findByRole('button', { name: 'Límites' });
    load.mockRejectedValue(new RoadmapAccessLostError('Acceso revocado'));
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(ROADMAP_CHANGE_RECEIVED_EVENT, {
          detail: { ...teachingInput.courseOffering.identifier, accessLost: true },
        }),
      );
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
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession
          courseOffering={{
            identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
            title: 'Programación I',
          }}
          experience={{ kind: 'teaching', term: 'current' }}
        />
      </RoadmapCanvasSessionPersistenceProvider>,
    );
    await screen.findByRole('button', { name: 'Límites' });

    act(() => {
      window.dispatchEvent(
        new CustomEvent(ROADMAP_CHANGE_RECEIVED_EVENT, {
          detail: { courseCode: 'CC1002', year: 2026, semester: 2 },
        }),
      );
    });
    expect(persistence.load).toHaveBeenCalledTimes(1);

    act(() => {
      for (let index = 0; index < 2; index += 1) {
        window.dispatchEvent(
          new CustomEvent(ROADMAP_CHANGE_RECEIVED_EVENT, {
            detail: { courseCode: 'CC1001', year: 2026, semester: 2 },
          }),
        );
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
    const persistence = createInMemoryRoadmapSessionPersistence(roadmap);
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession
          courseOffering={{
            identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
            title: 'Programación I',
          }}
          experience={{ kind: 'student', term: 'historical' }}
        />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    expect(
      (screen.getByRole('button', { name: 'Completar Límites' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test('keeps the loaded offering visible after a later completion failure and lets the student dismiss it', async () => {
    const user = userEvent.setup();
    const persistence = {
      load: vi.fn().mockResolvedValue(roadmap),
      complete: vi.fn().mockRejectedValue(new Error('No se pudo completar el nodo.')),
    };
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession
          courseOffering={{
            identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
            title: 'Programación I',
          }}
          experience={{ kind: 'student', term: 'current' }}
        />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    await user.click(await screen.findByRole('button', { name: 'Completar Límites' }));
    expect(
      await screen.findByRole('alert', { name: 'No se pudo completar el nodo.' }),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Límites' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cerrar alerta' }));
    await waitFor(() =>
      expect(screen.queryByRole('alert', { name: 'No se pudo completar el nodo.' })).toBeNull(),
    );
  });

  test('routes current teaching Canvas preview through the session and isolates simulated Completions', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...teachingInput} />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Vista estudiante' }));
    expect(await screen.findByText('Previsualización del canvas')).toBeTruthy();
    expect(screen.getByTestId('roadmap-mode').textContent).toBe('student');
    expect(screen.getByTestId('selected-node-id').textContent).toBe('');

    await user.click(screen.getByRole('button', { name: 'Límites' }));
    await user.click(screen.getByRole('button', { name: 'Completar Límites' }));
    await waitFor(async () =>
      expect((await persistence.loadSimulation!(teachingInput)).nodes[0]).toMatchObject({
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
      expect((await persistence.loadSimulation!(teachingInput)).nodes[0]).toMatchObject({
        isCompleted: false,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Ir al editor' }));
    expect(screen.queryByText('Previsualización del canvas')).toBeNull();
  });

  test('keeps historical teaching Canvas preview read-only through the session', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession
          courseOffering={teachingInput.courseOffering}
          experience={{ kind: 'teaching', term: 'historical' }}
        />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

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
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...teachingInput} />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }));
    expect(
      await screen.findByRole('status', { name: 'Cambios guardados exitosamente.' }),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Guardar enlace' }));
    expect(
      await screen.findByRole('status', { name: 'Enlace guardado exitosamente.' }),
    ).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Actualizar recurso' }));
    expect(
      await screen.findByRole('status', { name: 'Enlace guardado exitosamente.' }),
    ).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Eliminar recurso' }));
    await user.click(screen.getByRole('button', { name: 'Subir archivo' }));
    expect(
      await screen.findByRole('status', { name: 'Recurso guardado exitosamente.' }),
    ).toBeTruthy();

    const saved = await persistence.load(teachingInput);
    expect(saved.nodes[0]).toMatchObject({ title: 'Límites y continuidad' });
    expect(saved.nodes[0]).toHaveProperty('resources', [
      { id: 'resource-1', title: 'apuntes.pdf', url: 'apuntes.pdf', type: 'FILE' },
    ]);
  });

  test('routes construction through the public session and persists the confirmed layout', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...teachingInput} />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Crear en el mapa' }));
    await user.click(await screen.findByText('Crear nodo'));
    await user.type(screen.getByLabelText('Título'), 'Derivadas');
    await user.click(screen.getByRole('button', { name: 'Agregar nodo' }));
    await waitFor(() => expect(screen.getByTestId('selected-node-id').textContent).toBe('node-2'));

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

  test('routes Dependency creation and deletion through the public session', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence({
      ...teacherBlockedRoadmap,
      nodes: teacherBlockedRoadmap.nodes.map((node) =>
        node.id === 'node-1'
          ? ({ ...node, isTeacherBlocked: false } as RoadmapDto['nodes'][number])
          : node,
      ),
    });
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...teachingInput} />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Crear dependencia' }));
    expect(
      await screen.findByRole('status', { name: 'Dependencia creada exitosamente.' }),
    ).toBeTruthy();
    expect((await persistence.load(teachingInput)).dependencies).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Eliminar dependencia' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar eliminación' });
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    expect(
      await screen.findByRole('status', { name: 'Dependencia eliminada exitosamente.' }),
    ).toBeTruthy();
    await waitFor(async () =>
      expect((await persistence.load(teachingInput)).dependencies).toEqual([]),
    );
  });

  test('routes Node visibility and deletion through one public session confirmation', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...teachingInput} />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    const deleteNodeButton = screen.getByRole('button', { name: 'Eliminar nodo' });
    await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
    const visibilityDialog = await screen.findByRole('alertdialog', {
      name: 'Confirmar ocultación',
    });

    fireEvent.click(deleteNodeButton);
    expect(screen.getByRole('alertdialog', { name: 'Confirmar ocultación' })).toBe(
      visibilityDialog,
    );

    await user.click(within(visibilityDialog).getByRole('button', { name: 'Ocultar' }));
    await waitFor(async () =>
      expect((await persistence.load(teachingInput)).nodes[0]).toMatchObject({ isVisible: false }),
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar nodo' }));
    const deletionDialog = await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' });
    await user.click(within(deletionDialog).getByRole('button', { name: 'Eliminar Nodo' }));
    await waitFor(async () => expect((await persistence.load(teachingInput)).nodes).toEqual([]));
  });

  test('routes Teacher block through the public session workflow', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...teachingInput} />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Límites' }));
    await user.click(screen.getByRole('button', { name: 'Bloquear rama' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo de rama' });
    await user.click(within(dialog).getByRole('button', { name: 'Bloquear rama' }));

    await waitFor(async () =>
      expect((await persistence.load(teachingInput)).nodes[0]).toMatchObject({
        isTeacherBlocked: true,
      }),
    );
  });

  test('confirms an impacted Dependency creation through the public session', async () => {
    const user = userEvent.setup();
    const persistence = createInMemoryRoadmapSessionPersistence(teacherBlockedRoadmap);
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...teachingInput} />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Crear dependencia' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo' });
    expect(dialog.textContent).toContain('Derivadas');
    expect((await persistence.load(teachingInput)).dependencies).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Conectar y bloquear' }));
    expect(
      await screen.findByRole('status', { name: 'Dependencia creada exitosamente.' }),
    ).toBeTruthy();
    expect((await persistence.load(teachingInput)).nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'node-2', isTeacherBlocked: true })]),
    );
  });

  test('retries only failed Dependency deletions through the public session', async () => {
    const user = userEvent.setup();
    const memory = createInMemoryRoadmapSessionPersistence(twoDependenciesRoadmap);
    let shouldFail = true;
    const persistence = {
      ...memory,
      async deleteDependency(...args: Parameters<NonNullable<typeof memory.deleteDependency>>) {
        if (args[1] === 'dependency-2' && shouldFail) {
          shouldFail = false;
          throw new Error('No se pudo eliminar la dependencia.');
        }
        return memory.deleteDependency!(...args);
      },
    };
    render(
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...teachingInput} />
      </RoadmapCanvasSessionPersistenceProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Eliminar dependencias' }));
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Confirmar eliminación' })).getByRole(
        'button',
        { name: 'Eliminar' },
      ),
    );
    const retryDialog = await screen.findByRole('alertdialog', { name: 'Confirmar eliminación' });
    expect(retryDialog.textContent).toContain('esta dependencia');
    expect((await memory.load(teachingInput)).dependencies).toEqual([
      expect.objectContaining({ id: 'dependency-2' }),
    ]);

    await user.click(within(retryDialog).getByRole('button', { name: 'Eliminar' }));
    await waitFor(async () => expect((await memory.load(teachingInput)).dependencies).toEqual([]));
  });
});

test('current teaching sessions recover missed changes and retain the last projection on transient failure', async () => {
  const persistence = createInMemoryRoadmapSessionPersistence(teachingRoadmap);
  const load = vi.spyOn(persistence, 'load');
  render(
    <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
      <RoadmapCanvasSession {...teachingInput} />
    </RoadmapCanvasSessionPersistenceProvider>,
  );
  await screen.findByRole('button', { name: 'Límites' });
  await persistence.updateNode!(teachingInput, 'node-1', {
    title: 'Cambio remoto',
    description: '',
    nodeTypeId: teachingRoadmap.nodes[0].nodeTypeId,
  });
  act(() => window.dispatchEvent(new Event('online')));
  await screen.findByRole('button', { name: 'Cambio remoto' });
  load.mockRejectedValueOnce(new Error('Fallo transitorio'));
  act(() => window.dispatchEvent(new Event('online')));
  await screen.findByText('Fallo transitorio');
  expect(screen.getByRole('button', { name: 'Cambio remoto' })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar actualización' }));
  await waitFor(() => expect(screen.queryByText('Fallo transitorio')).toBeNull());
});
