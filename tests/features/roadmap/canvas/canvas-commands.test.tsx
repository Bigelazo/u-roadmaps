import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import {
  RoadmapCanvasSessionPersistenceProvider,
  useRoadmapCanvasSession,
  type RoadmapCanvasSessionOptions,
} from '@/features/roadmap/session/session';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';
import type { RoadmapDto } from '@/features/roadmap/types';

const teachingInput = {
  courseOffering: {
    identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
    title: 'Cálculo',
  },
  experience: { kind: 'teaching' as const, term: 'current' as const },
};

function teachingNode(id: string, title: string, isVisible = true): RoadmapDto['nodes'][number] {
  return {
    id,
    title,
    description: null,
    nodeTypeId: 'content',
    positionX: 0,
    positionY: 0,
    isVisible,
    isTeacherBlocked: false,
    resources: [],
  };
}

function dependency(id: string, sourceNodeId: string, targetNodeId: string) {
  return { id, sourceNodeId, targetNodeId, sourceHandle: 'right', targetHandle: 'left' } as const;
}

/** Límites → Derivadas, with Integrales unconnected and Series hidden. */
const roadmap: RoadmapDto = {
  course: { code: 'CC1001', name: 'Cálculo', department: 'DIM' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [
    { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
  ],
  nodes: [
    teachingNode('limits', 'Límites'),
    teachingNode('derivatives', 'Derivadas'),
    teachingNode('integrals', 'Integrales'),
    teachingNode('series', 'Series', false),
  ],
  dependencies: [dependency('limits-derivatives', 'limits', 'derivatives')],
};

async function openCanvas(
  persistence: RoadmapCanvasSessionPersistence = createInMemoryRoadmapSessionPersistence(roadmap),
  options: RoadmapCanvasSessionOptions = {},
) {
  const closeEditor = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
      {children}
    </RoadmapCanvasSessionPersistenceProvider>
  );
  const { result } = renderHook(
    () => useRoadmapCanvasSession(teachingInput, { closeEditor, ...options }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.roadmap).not.toBeNull());
  const commands = () => result.current.canvasCommands;
  return {
    persistence,
    closeEditor,
    commands,
    session: () => result.current,
    async awaiting() {
      await waitFor(() => expect(commands().pending?.phase).toBe('awaiting'));
      return commands().pending!;
    },
    async confirm(choice: string) {
      await act(() => commands().confirm(choice));
    },
  };
}

async function nodeOf(persistence: RoadmapCanvasSessionPersistence, nodeId: string) {
  return (await persistence.load(teachingInput)).nodes.find(({ id }) => id === nodeId);
}

describe('canvas commands', () => {
  test('hiding a Node shows its Change impact and hides it on confirmation', async () => {
    const canvas = await openCanvas();

    await act(() => canvas.commands().request({ kind: 'hide-node', nodeId: 'limits' }));
    expect(await canvas.awaiting()).toMatchObject({
      kind: 'hide-node',
      request: { kind: 'hide-node', nodeId: 'limits' },
      impact: { dependencies: [{ id: 'limits-derivatives' }] },
    });

    await canvas.confirm('hide-node');

    expect(canvas.commands().pending).toBeNull();
    expect(await nodeOf(canvas.persistence, 'limits')).toMatchObject({ isVisible: false });
    expect((await canvas.persistence.load(teachingInput)).dependencies).toEqual([]);
  });

  test('showing a hidden Node asks for confirmation without a Change impact', async () => {
    const canvas = await openCanvas();

    await act(() => canvas.commands().request({ kind: 'show-node', nodeId: 'series' }));
    expect(canvas.commands().pending).toEqual({
      kind: 'show-node',
      request: { kind: 'show-node', nodeId: 'series' },
      impact: null,
      phase: 'awaiting',
    });

    await canvas.confirm('show-node');

    expect(canvas.commands().pending).toBeNull();
    expect(await nodeOf(canvas.persistence, 'series')).toMatchObject({ isVisible: true });
  });

  test('deleting a Node shows its Change impact, deletes it and closes the editor', async () => {
    const canvas = await openCanvas();

    await act(() => canvas.commands().request({ kind: 'delete-node', nodeId: 'limits' }));
    expect(await canvas.awaiting()).toMatchObject({
      kind: 'delete-node',
      impact: {
        node: { title: 'Límites' },
        dependencies: [{ sourceTitle: 'Límites', targetTitle: 'Derivadas' }],
      },
    });

    await canvas.confirm('delete-node');

    expect(canvas.commands().pending).toBeNull();
    expect(await nodeOf(canvas.persistence, 'limits')).toBeUndefined();
    expect(canvas.closeEditor).toHaveBeenCalledOnce();
  });

  test('cancelling an awaiting confirmation changes nothing and frees the slot', async () => {
    const canvas = await openCanvas();

    await act(() => canvas.commands().request({ kind: 'hide-node', nodeId: 'limits' }));
    await canvas.awaiting();
    act(() => canvas.commands().cancel());

    expect(canvas.commands().pending).toBeNull();
    expect(await nodeOf(canvas.persistence, 'limits')).toMatchObject({ isVisible: true });
  });

  test.each([
    ['hide-node', [{ id: 'limits-derivatives' }, { sourceNodeId: 'limits' }]],
    [
      'delete-node',
      [{ targetTitle: 'Derivadas' }, { sourceTitle: 'Límites', targetTitle: 'Integrales' }],
    ],
  ] as const)(
    'shows the new Change impact instead of applying %s when it changed after opening',
    async (kind, latestDependencies) => {
      const canvas = await openCanvas();
      await act(() => canvas.commands().request({ kind, nodeId: 'limits' }));
      await canvas.awaiting();

      await canvas.persistence.connectNodes(teachingInput, {
        sourceNodeId: 'limits',
        targetNodeId: 'integrals',
        sourceHandle: 'right',
        targetHandle: 'left',
      });
      await canvas.confirm(kind);

      expect(canvas.commands().pending).toMatchObject({
        kind,
        phase: 'awaiting',
        impact: { dependencies: latestDependencies.map((item) => expect.objectContaining(item)) },
      });
      expect(await nodeOf(canvas.persistence, 'limits')).toMatchObject({ isVisible: true });

      await canvas.confirm(kind);
      expect(canvas.commands().pending).toBeNull();
      expect((await canvas.persistence.load(teachingInput)).dependencies).toEqual([]);
    },
  );

  test.each([
    ['hide-node', 'setVisibility', 'de ocultar el nodo', [{ id: 'limits-derivatives' }, {}]],
    [
      'delete-node',
      'deleteNode',
      'de la eliminación',
      [{ targetTitle: 'Derivadas' }, { sourceTitle: 'Integrales' }],
    ],
  ] as const)(
    'shows the latest Change impact when the %s write is refused as stale, and confirms it again',
    async (kind, write, impactName, latestDependencies) => {
      const adapter = createInMemoryRoadmapSessionPersistence(roadmap);
      let raceOnce = true;
      // Another editor connects the Node after the confirmation revalidated, before the write lands.
      const persistence: RoadmapCanvasSessionPersistence = {
        ...adapter,
        async [write](...args: Parameters<RoadmapCanvasSessionPersistence[typeof write]>) {
          if (raceOnce) {
            raceOnce = false;
            await adapter.connectNodes(args[0], {
              sourceNodeId: 'integrals',
              targetNodeId: 'limits',
              sourceHandle: 'right',
              targetHandle: 'left',
            });
          }
          return (adapter[write] as (...forwarded: typeof args) => Promise<void>)(...args);
        },
      };
      const canvas = await openCanvas(persistence);
      await act(() => canvas.commands().request({ kind, nodeId: 'limits' }));
      await canvas.awaiting();

      await canvas.confirm(kind);

      expect(canvas.session().error).toBe(
        `El impacto ${impactName} cambió. Revisa y confirma la previsualización actualizada.`,
      );
      expect(canvas.commands().pending).toMatchObject({
        phase: 'awaiting',
        impact: { dependencies: latestDependencies.map((item) => expect.objectContaining(item)) },
      });
      expect((await persistence.load(teachingInput)).dependencies).toHaveLength(2);

      await canvas.confirm(kind);
      expect(canvas.commands().pending).toBeNull();
      expect((await persistence.load(teachingInput)).dependencies).toEqual([]);
    },
  );

  test('keeps one Confirmed action pending at a time', async () => {
    const canvas = await openCanvas();
    await act(() => canvas.commands().request({ kind: 'hide-node', nodeId: 'limits' }));
    const pending = await canvas.awaiting();

    await act(() => canvas.commands().request({ kind: 'delete-node', nodeId: 'derivatives' }));
    await act(() => canvas.commands().request({ kind: 'show-node', nodeId: 'series' }));

    expect(canvas.commands().pending).toBe(pending);
  });

  test('opens no Confirmed action while a confirmation the view coordinates is open', async () => {
    const canvas = await openCanvas(undefined, { isOtherConfirmationOpen: () => true });

    await act(() => canvas.commands().request({ kind: 'hide-node', nodeId: 'limits' }));

    expect(canvas.commands().pending).toBeNull();
  });

  test('asks about the unsaved draft once, before the deletion claims the slot', async () => {
    let answer: (proceed: boolean) => void = () => undefined;
    const guardDraft = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)));
    const canvas = await openCanvas(undefined, { guardDraft });

    let deletion: Promise<void> = Promise.resolve();
    act(() => {
      deletion = canvas.commands().request({ kind: 'delete-node', nodeId: 'limits' });
    });
    expect(guardDraft).toHaveBeenCalledExactlyOnceWith({ kind: 'delete-node', nodeId: 'limits' });
    expect(canvas.commands().pending).toBeNull();

    await act(async () => {
      answer(true);
      await deletion;
    });
    expect((await canvas.awaiting()).kind).toBe('delete-node');
    expect(guardDraft).toHaveBeenCalledOnce();
  });

  test('keeps the Node and opens nothing when the draft is kept', async () => {
    const canvas = await openCanvas(undefined, { guardDraft: async () => false });

    await act(() => canvas.commands().request({ kind: 'delete-node', nodeId: 'limits' }));

    expect(canvas.commands().pending).toBeNull();
    expect(await nodeOf(canvas.persistence, 'limits')).toBeDefined();
  });
});
