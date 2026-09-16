import { forwardRef, useImperativeHandle } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import {
  RoadmapCanvasSession,
  createInMemoryRoadmapSessionPersistence,
} from '@/features/roadmap/session';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import type { NodeEditorProps } from '@/features/roadmap/editor/types';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';

vi.mock('next/dynamic', () => ({
  default: () =>
    forwardRef(function NodeEditorMock({ session, perform }: NodeEditorProps, ref) {
      useImperativeHandle(ref, () => ({ guardDraft: vi.fn().mockResolvedValue(true) }), []);
      if (!session.node) return null;
      const resource = session.node.resources[0];
      return (
        <aside>
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
  }: {
    projection: { roadmap: { nodes: Array<{ id: string; title: string }> } };
    onSelectNode: (nodeId: string) => void;
  }) => (
    <button type="button" onClick={() => onSelectNode(projection.roadmap.nodes[0].id)}>
      {projection.roadmap.nodes[0].title}
    </button>
  ),
}));

vi.mock('@/features/roadmap/student/NodeDetail', () => ({
  StudentNodeDetail: ({
    node,
    onComplete,
  }: {
    node?: { id: string; title: string };
    onComplete: (node: { id: string }) => void;
  }) =>
    node ? (
      <button type="button" onClick={() => onComplete(node)}>
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
});
