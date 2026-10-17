import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import {
  RoadmapCanvasSessionPersistenceProvider,
  useRoadmapCanvasSession,
  type RoadmapCanvasSessionOptions,
} from '@/features/roadmap/session/session';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';
import type { RoadmapDto } from '@/features/roadmap/types';
import { notify } from '@/shared/ui/notify';

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
  vi.spyOn(notify, 'success');
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

/** The fixture Roadmap with these Nodes Teacher-blocked. */
function withTeacherBlocks(...nodeIds: string[]): RoadmapDto {
  return {
    ...roadmap,
    nodes: roadmap.nodes.map((node) =>
      node.isVisible && nodeIds.includes(node.id) ? { ...node, isTeacherBlocked: true } : node,
    ),
  };
}

async function teacherBlockedNodeIds(persistence: RoadmapCanvasSessionPersistence) {
  return (await persistence.load(teachingInput)).nodes.flatMap((node) =>
    'isTeacherBlocked' in node && node.isTeacherBlocked ? [node.id] : [],
  );
}

const successToasts = () => vi.mocked(notify.success).mock.calls.map(([message]) => message);

async function nodeOf(persistence: RoadmapCanvasSessionPersistence, nodeId: string) {
  return (await persistence.load(teachingInput)).nodes.find(({ id }) => id === nodeId);
}

describe('canvas commands', () => {
  afterEach(() => vi.restoreAllMocks());
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

  describe('Teacher block', () => {
    test('blocking a Node shows the dependents it blocks along and blocks them on confirmation', async () => {
      const canvas = await openCanvas();

      await act(() =>
        canvas
          .commands()
          .request({ kind: 'change-teacher-block', nodeId: 'limits', operation: 'BLOCK' }),
      );
      expect(await canvas.awaiting()).toMatchObject({
        kind: 'change-teacher-block',
        impact: {
          BLOCK: {
            mode: 'BLOCK',
            nodes: [
              { id: 'limits', relation: 'SELECTED_NODE' },
              { id: 'derivatives', relation: 'DEPENDENT' },
            ],
          },
        },
      });

      await canvas.confirm('block-teacher');

      expect(canvas.commands().pending).toBeNull();
      expect(await teacherBlockedNodeIds(canvas.persistence)).toEqual(['limits', 'derivatives']);
    });

    test.each([
      ['unlock-node', 'only the Node', ['derivatives']],
      ['unlock-branch', 'the Node and its dependents', []],
    ] as const)(
      'an unlock offers both scopes, and %s unlocks %s',
      async (choice, _, stillBlocked) => {
        const canvas = await openCanvas(
          createInMemoryRoadmapSessionPersistence(withTeacherBlocks('limits', 'derivatives')),
        );

        await act(() =>
          canvas
            .commands()
            .request({ kind: 'change-teacher-block', nodeId: 'limits', operation: 'UNBLOCK' }),
        );
        expect(await canvas.awaiting()).toMatchObject({
          impact: {
            UNBLOCK: { mode: 'SINGLE', nodes: [{ id: 'limits' }] },
            BRANCH_UNLOCK: { mode: 'BRANCH', nodes: [{ id: 'limits' }, { id: 'derivatives' }] },
          },
        });

        await canvas.confirm(choice);

        expect(canvas.commands().pending).toBeNull();
        expect(await teacherBlockedNodeIds(canvas.persistence)).toEqual(stillBlocked);
      },
    );

    test('unlocking behind a blocked prerequisite unlocks the prerequisites too', async () => {
      const canvas = await openCanvas(
        createInMemoryRoadmapSessionPersistence(withTeacherBlocks('limits', 'derivatives')),
      );

      await act(() =>
        canvas
          .commands()
          .request({ kind: 'change-teacher-block', nodeId: 'derivatives', operation: 'UNBLOCK' }),
      );
      expect((await canvas.awaiting()).impact).toMatchObject({
        UNBLOCK: {
          mode: 'UPSTREAM',
          nodes: [
            { id: 'limits', relation: 'PREREQUISITE' },
            { id: 'derivatives', relation: 'SELECTED_NODE' },
          ],
        },
      });

      await canvas.confirm('unlock-prerequisites');

      expect(canvas.commands().pending).toBeNull();
      expect(await teacherBlockedNodeIds(canvas.persistence)).toEqual([]);
    });

    /** Connects Derivadas to Integrales, which Teacher-blocks Integrales behind the blocked branch. */
    const blockIntegralsBehindDerivatives = (persistence: RoadmapCanvasSessionPersistence) =>
      persistence.connectNodes(teachingInput, {
        sourceNodeId: 'derivatives',
        targetNodeId: 'integrals',
        sourceHandle: 'right',
        targetHandle: 'left',
      });

    test('shows both new unlock scopes instead of unlocking when either changed after opening', async () => {
      const canvas = await openCanvas(
        createInMemoryRoadmapSessionPersistence(withTeacherBlocks('limits', 'derivatives')),
      );
      await act(() =>
        canvas
          .commands()
          .request({ kind: 'change-teacher-block', nodeId: 'limits', operation: 'UNBLOCK' }),
      );
      await canvas.awaiting();

      await blockIntegralsBehindDerivatives(canvas.persistence);
      await canvas.confirm('unlock-node');

      expect(canvas.commands().pending).toMatchObject({
        phase: 'awaiting',
        impact: {
          UNBLOCK: { mode: 'SINGLE', nodes: [{ id: 'limits' }] },
          BRANCH_UNLOCK: { nodes: [{ id: 'limits' }, { id: 'derivatives' }, { id: 'integrals' }] },
        },
      });
      expect(await teacherBlockedNodeIds(canvas.persistence)).toEqual([
        'limits',
        'derivatives',
        'integrals',
      ]);

      await canvas.confirm('unlock-node');
      expect(canvas.commands().pending).toBeNull();
      expect(await teacherBlockedNodeIds(canvas.persistence)).toEqual(['derivatives', 'integrals']);
    });

    test('shows the latest unlock scopes when the chosen unlock is refused as stale, and confirms it again', async () => {
      const adapter = createInMemoryRoadmapSessionPersistence(
        withTeacherBlocks('limits', 'derivatives'),
      );
      let raceOnce = true;
      // Another editor extends the blocked branch after the confirmation revalidated.
      const persistence: RoadmapCanvasSessionPersistence = {
        ...adapter,
        async changeTeacherBlock(...args) {
          if (raceOnce) {
            raceOnce = false;
            await blockIntegralsBehindDerivatives(adapter);
          }
          return adapter.changeTeacherBlock(...args);
        },
      };
      const canvas = await openCanvas(persistence);
      await act(() =>
        canvas
          .commands()
          .request({ kind: 'change-teacher-block', nodeId: 'limits', operation: 'UNBLOCK' }),
      );
      await canvas.awaiting();

      await canvas.confirm('unlock-branch');

      expect(canvas.session().error).toBe(
        'El impacto del desbloqueo cambió. Revisa y confirma la previsualización actualizada.',
      );
      expect(canvas.commands().pending).toMatchObject({
        phase: 'awaiting',
        impact: { BRANCH_UNLOCK: { nodes: [{}, {}, { id: 'integrals' }] } },
      });
      expect(await teacherBlockedNodeIds(persistence)).toHaveLength(3);

      await canvas.confirm('unlock-branch');
      expect(canvas.commands().pending).toBeNull();
      expect(await teacherBlockedNodeIds(persistence)).toEqual([]);
    });
  });

  describe('Dependency creation', () => {
    const connectLimitsToIntegrals = {
      kind: 'create-dependency',
      sourceNodeId: 'limits',
      targetNodeId: 'integrals',
      sourceHandle: 'right',
      targetHandle: 'left',
    } as const;

    async function dependencyPairs(persistence: RoadmapCanvasSessionPersistence) {
      return (await persistence.load(teachingInput)).dependencies.map(
        ({ sourceNodeId, targetNodeId }) => `${sourceNodeId}→${targetNodeId}`,
      );
    }

    test('creates a Dependency without Change impact at once, without asking', async () => {
      const canvas = await openCanvas();

      await act(() => canvas.commands().request(connectLimitsToIntegrals));

      expect(canvas.commands().pending).toBeNull();
      expect(await dependencyPairs(canvas.persistence)).toEqual([
        'limits→derivatives',
        'limits→integrals',
      ]);
      expect(successToasts()).toEqual(['Dependencia creada exitosamente.']);
    });

    test('frees the slot without asking when a creation without Change impact fails', async () => {
      const adapter = createInMemoryRoadmapSessionPersistence(roadmap);
      const canvas = await openCanvas({
        ...adapter,
        connectNodes: async () => {
          throw new Error('No se pudo crear la dependencia.');
        },
      });

      await act(() => canvas.commands().request(connectLimitsToIntegrals));

      expect(canvas.commands().pending).toBeNull();
      expect(canvas.session().error).toBe('No se pudo crear la dependencia.');
      expect(await dependencyPairs(adapter)).toEqual(['limits→derivatives']);
      expect(successToasts()).toEqual([]);
    });

    test('asks before creating a Dependency that Teacher-blocks Nodes, then blocks them', async () => {
      const canvas = await openCanvas(
        createInMemoryRoadmapSessionPersistence(withTeacherBlocks('limits')),
      );

      await act(() => canvas.commands().request(connectLimitsToIntegrals));
      expect(await canvas.awaiting()).toMatchObject({
        kind: 'create-dependency',
        impact: { nodes: [{ id: 'integrals' }] },
      });
      expect(await dependencyPairs(canvas.persistence)).toEqual(['limits→derivatives']);

      await canvas.confirm('create-dependency');

      expect(canvas.commands().pending).toBeNull();
      expect(await dependencyPairs(canvas.persistence)).toContain('limits→integrals');
      expect(await teacherBlockedNodeIds(canvas.persistence)).toEqual(['limits', 'integrals']);
      expect(successToasts()).toEqual(['Dependencia creada exitosamente.']);
    });

    test('shows the new Change impact instead of creating the Dependency when it grew after opening', async () => {
      const canvas = await openCanvas(
        createInMemoryRoadmapSessionPersistence(withTeacherBlocks('limits')),
      );
      await act(() => canvas.commands().request(connectLimitsToIntegrals));
      await canvas.awaiting();

      await canvas.persistence.connectNodes(teachingInput, {
        sourceNodeId: 'integrals',
        targetNodeId: 'derivatives',
        sourceHandle: 'right',
        targetHandle: 'left',
      });
      await canvas.confirm('create-dependency');

      expect(canvas.commands().pending).toMatchObject({
        phase: 'awaiting',
        impact: { nodes: [{ id: 'derivatives' }, { id: 'integrals' }] },
      });
      expect(await dependencyPairs(canvas.persistence)).not.toContain('limits→integrals');

      await canvas.confirm('create-dependency');
      expect(canvas.commands().pending).toBeNull();
      expect(await teacherBlockedNodeIds(canvas.persistence)).toEqual([
        'limits',
        'derivatives',
        'integrals',
      ]);
    });

    test('creates the Dependency at once when its Change impact vanished after opening', async () => {
      const canvas = await openCanvas(
        createInMemoryRoadmapSessionPersistence(withTeacherBlocks('limits')),
      );
      await act(() => canvas.commands().request(connectLimitsToIntegrals));
      await canvas.awaiting();

      await canvas.persistence.changeTeacherBlock(teachingInput, 'integrals', 'BLOCK');
      await canvas.confirm('create-dependency');

      expect(canvas.commands().pending).toBeNull();
      expect(await dependencyPairs(canvas.persistence)).toContain('limits→integrals');
      expect(successToasts()).toEqual(['Dependencia creada exitosamente.']);
    });

    test('shows the latest Change impact when the creation is refused as stale, and confirms it again', async () => {
      const adapter = createInMemoryRoadmapSessionPersistence(withTeacherBlocks('limits'));
      let raceOnce = true;
      // Another editor connects Integrales onwards after the confirmation revalidated.
      const persistence: RoadmapCanvasSessionPersistence = {
        ...adapter,
        async connectNodes(...args) {
          if (raceOnce) {
            raceOnce = false;
            await adapter.connectNodes(teachingInput, {
              sourceNodeId: 'integrals',
              targetNodeId: 'derivatives',
              sourceHandle: 'right',
              targetHandle: 'left',
            });
          }
          return adapter.connectNodes(...args);
        },
      };
      const canvas = await openCanvas(persistence);
      await act(() => canvas.commands().request(connectLimitsToIntegrals));
      await canvas.awaiting();

      await canvas.confirm('create-dependency');

      expect(canvas.session().error).toBe(
        'El impacto de la dependencia cambió. Revisa y confirma la previsualización actualizada.',
      );
      expect(canvas.commands().pending).toMatchObject({
        phase: 'awaiting',
        impact: { nodes: [{ id: 'derivatives' }, { id: 'integrals' }] },
      });
      expect(successToasts()).toEqual([]);

      await canvas.confirm('create-dependency');
      expect(canvas.commands().pending).toBeNull();
      expect(await dependencyPairs(persistence)).toContain('limits→integrals');
    });
  });

  test('retries only the Dependency deletions that failed, counting only the deleted ones', async () => {
    const adapter = createInMemoryRoadmapSessionPersistence({
      ...roadmap,
      dependencies: [
        ...roadmap.dependencies,
        dependency('limits-integrals', 'limits', 'integrals'),
      ],
    });
    let failOnce = true;
    const persistence: RoadmapCanvasSessionPersistence = {
      ...adapter,
      async deleteDependency(input, dependencyId) {
        if (dependencyId === 'limits-integrals' && failOnce) {
          failOnce = false;
          throw new Error('No se pudo eliminar la dependencia.');
        }
        return adapter.deleteDependency(input, dependencyId);
      },
    };
    const canvas = await openCanvas(persistence);
    const dependencyIds = async () =>
      (await persistence.load(teachingInput)).dependencies.map(({ id }) => id);

    await act(() =>
      canvas.commands().request({
        kind: 'delete-dependencies',
        dependencyIds: ['limits-derivatives', 'limits-integrals'],
      }),
    );
    expect(await canvas.awaiting()).toMatchObject({ kind: 'delete-dependencies', impact: null });

    await canvas.confirm('delete-dependencies');

    expect(canvas.commands().pending).toEqual({
      kind: 'delete-dependencies',
      request: { kind: 'delete-dependencies', dependencyIds: ['limits-integrals'] },
      impact: null,
      phase: 'awaiting',
    });
    expect(await dependencyIds()).toEqual(['limits-integrals']);
    expect(successToasts()).toEqual(['Dependencia eliminada exitosamente.']);

    await canvas.confirm('delete-dependencies');

    expect(canvas.commands().pending).toBeNull();
    expect(await dependencyIds()).toEqual([]);
    expect(successToasts()).toEqual([
      'Dependencia eliminada exitosamente.',
      'Dependencia eliminada exitosamente.',
    ]);
  });
});
