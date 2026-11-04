import type { ComponentProps, ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, expect, test, vi } from 'vitest';
import { RoadmapCanvasSession } from '@/features/roadmap/session';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import { Toaster } from '@/shared/ui/toast';
import { findToast } from '../../../support/toast';
import { mockViewport } from '../../../support/viewport';

beforeEach(() => mockViewport(640));
afterAll(() => vi.unstubAllGlobals());

vi.mock('next/dynamic', async () => {
  const { NodeEditor } = await import('@/features/roadmap/editor/NodeEditor');
  return { default: () => NodeEditor };
});

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
      {projection.roadmap.nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onSelectNode(node.id)}>
          {node.title}
        </button>
      ))}
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

test.each([false, true])(
  'resets preview progress with a selected dependent node (completed: %s)',
  async (completeDependent) => {
    const user = userEvent.setup();
    const dependent = { ...limitsNode, id: 'node-2', title: 'Derivadas' };
    const persistence = createInMemoryRoadmapSessionPersistence({
      ...teachingRoadmap,
      nodes: [limitsNode, dependent],
      dependencies: [
        {
          id: 'dependency-1',
          sourceNodeId: limitsNode.id,
          targetNodeId: dependent.id,
          sourceHandle: 'bottom',
          targetHandle: 'top',
        },
      ],
    });
    renderSession(persistence);

    await user.click(await screen.findByRole('button', { name: 'Vista estudiante' }));
    await user.click(screen.getByRole('button', { name: 'Límites' }));
    await user.click(screen.getByRole('button', { name: 'Completar Límites' }));
    await waitFor(async () =>
      expect((await persistence.loadSimulation(teachingInput)).nodes[1]).toMatchObject({
        access: { status: 'ACCESSIBLE' },
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Derivadas' }));
    if (completeDependent) {
      await user.click(screen.getByRole('button', { name: 'Completar Derivadas' }));
    }
    await waitFor(async () =>
      expect((await persistence.loadSimulation(teachingInput)).nodes[1]).toMatchObject({
        isCompleted: completeDependent,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Reiniciar progreso' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Reiniciar progreso de previsualización',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Reiniciar progreso' }));
    expect(await findToast('Progreso de previsualización reiniciado.')).toBeTruthy();
    expect(screen.queryByLabelText('Editor de nodo')).toBeNull();
    const reset = await persistence.loadSimulation(teachingInput);
    expect(reset.nodes[1]).toMatchObject({ access: { status: 'BLOCKED' } });
    expect(reset.nodes[1]).not.toHaveProperty('resources');
    expect(screen.queryByRole('button', { name: 'Completar Derivadas' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Ir al editor' }));
    await user.click(screen.getByRole('button', { name: 'Derivadas' }));
    expect(await screen.findByRole('heading', { name: 'Recursos (0)' })).toBeTruthy();
    expect((await persistence.load(teachingInput)).nodes).toEqual([limitsNode, dependent]);
  },
);
