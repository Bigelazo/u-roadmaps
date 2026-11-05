import { StrictMode, type ComponentProps } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { RoadmapGraphProps } from '@/features/roadmap/graph/RoadmapGraph';
import { RoadmapCanvasSession } from '@/features/roadmap/session';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import type { RoadmapDto } from '@/features/roadmap/types';
import { Toaster } from '@/shared/ui/toast';
import { findToast } from '../../../support/toast';
import { mockViewport } from '../../../support/viewport';

beforeEach(() => mockViewport(1280));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Vitest resolves Next's loader to a wrapper whose ref exposes retry/loading. Execute
// the supplied loader while retaining React 19 ref/props; chunk loading stays an E2E concern.
vi.mock('next/dynamic', async () => {
  const { lazy, Suspense } = await import('react');
  return {
    default: <Props extends object>(loader: () => Promise<React.ComponentType<Props>>) => {
      const Component = lazy(async () => ({ default: await loader() }));
      return function DynamicComponent(props: Props) {
        return (
          <Suspense fallback={null}>
            <Component {...props} />
          </Suspense>
        );
      };
    },
  };
});

vi.mock('@/features/roadmap/graph/RoadmapGraph', () => ({
  RoadmapGraph: ({
    projection,
    onSelectNode,
    bottomLeftActions,
    bottomRightActions,
    overlaySlots,
  }: RoadmapGraphProps) => (
    <>
      {bottomLeftActions?.(() => ({ x: 480, y: 240 }))}
      {bottomRightActions?.(() => ({ x: 480, y: 240 }))}
      {overlaySlots?.topCenter}
      {projection.roadmap.nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onSelectNode(node.id)}>
          {node.title}
        </button>
      ))}
    </>
  ),
}));

type SessionInput = ComponentProps<typeof RoadmapCanvasSession>;
type SessionPersistence = ComponentProps<
  typeof RoadmapCanvasSessionPersistenceProvider
>['persistence'];

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

const teachingRoadmap: RoadmapDto = {
  course: { code: 'CC1001', name: 'Programación I', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [
    { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
  ],
  nodes: [limitsNode],
  dependencies: [],
};

function courseInput(courseCode = 'CC1001', title = 'Programación I') {
  return { identifier: { courseCode, year: 2026, semester: 2 }, title };
}

const teachingInput = {
  courseOffering: courseInput(),
  experience: { kind: 'teaching' as const, term: 'current' as const },
};

function renderSession(persistence: SessionPersistence, input: SessionInput = teachingInput) {
  return render(
    <StrictMode>
      <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
        <RoadmapCanvasSession {...input} />
        <Toaster />
      </RoadmapCanvasSessionPersistenceProvider>
    </StrictMode>,
  );
}

test.each([false, true])(
  'resets preview progress with a selected dependent node (completed: %s)',
  async (completeDependent) => {
    const user = userEvent.setup();
    const dependent = {
      ...limitsNode,
      id: 'node-2',
      title: 'Derivadas',
      description: 'La derivada mide la variación instantánea.',
      resources: [
        {
          id: 'derivatives-guide',
          title: 'Guía exclusiva de derivadas',
          type: 'LINK' as const,
          url: 'https://example.edu/derivadas',
        },
      ],
    };
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

    await user.click(await screen.findByRole('button', { name: 'Derivadas' }));
    const initialEditor = screen.getByLabelText('Panel de edición del roadmap');
    expect(await within(initialEditor).findByRole('heading', { name: 'Derivadas' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Vista estudiante' }));
    await user.click(screen.getByRole('button', { name: 'Límites' }));
    const prerequisitePanel = await screen.findByLabelText('Límites');
    await user.click(within(prerequisitePanel).getByRole('button', { name: 'Completar' }));
    await waitFor(async () =>
      expect((await persistence.loadCanvasPreview()).nodes[1]).toMatchObject({
        access: { status: 'ACCESSIBLE' },
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Derivadas' }));
    const detail = await screen.findByLabelText('Derivadas');
    expect(within(detail).getByText(dependent.description)).toBeTruthy();
    expect(
      within(detail)
        .getByRole('link', { name: 'Guía exclusiva de derivadas' })
        .getAttribute('href'),
    ).toBe('https://example.edu/derivadas');
    if (completeDependent) {
      await user.click(within(detail).getByRole('button', { name: 'Completar' }));
    }
    await waitFor(async () =>
      expect((await persistence.loadCanvasPreview()).nodes[1]).toMatchObject({
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
    const reset = await persistence.loadCanvasPreview();
    expect(reset.nodes[1]).toMatchObject({ access: { status: 'BLOCKED' } });
    expect(reset.nodes[1]).not.toHaveProperty('description');
    expect(reset.nodes[1]).not.toHaveProperty('resources');
    expect(screen.queryByText(dependent.description)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Guía exclusiva de derivadas' })).toBeNull();
    expect(screen.queryByLabelText('Derivadas')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Ir al editor' }));
    await user.click(screen.getByRole('button', { name: 'Derivadas' }));
    const editor = await screen.findByLabelText('Panel de edición del roadmap');
    expect(await within(editor).findByRole('heading', { name: 'Recursos (1)' })).toBeTruthy();
    expect(
      (within(editor).getByRole('textbox', { name: /Descripción/ }) as HTMLTextAreaElement).value,
    ).toBe(dependent.description);
    expect(
      within(editor)
        .getByRole('link', { name: 'Abrir recurso Guía exclusiva de derivadas' })
        .getAttribute('href'),
    ).toBe('https://example.edu/derivadas');
    expect((await persistence.load()).nodes).toEqual([limitsNode, dependent]);
  },
);
