import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import {
  RoadmapCanvasSessionPersistenceProvider,
  useRoadmapCanvasSession,
  type RoadmapCanvasSessionOptions,
} from '@/features/roadmap/session/session';
import type {
  PracticeCanvasAction,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';
import type {
  CanvasCommandOf,
  CanvasConfirmationChoice,
  ConfirmedActionKind,
  UnconfirmedCommand,
} from '@/features/roadmap/canvas/commands/commands';
import type { NodeType, RoadmapDto, RoadmapNode } from '@/features/roadmap/types';
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
  const onCommandApplied = vi.fn();
  const report = vi.fn<(action: PracticeCanvasAction) => void>();
  // The Practice roadmap is told about every canvas action that took effect.
  const input = { ...teachingInput, practice: { nodeChangeCounts: {}, onAction: report } };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
      {children}
    </RoadmapCanvasSessionPersistenceProvider>
  );
  vi.spyOn(notify, 'success');
  const { result } = renderHook(
    () => useRoadmapCanvasSession(input, { onCommandApplied, ...options }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.roadmap).not.toBeNull());
  const commands = () => result.current.canvasCommands;
  return {
    persistence,
    onCommandApplied,
    reported: () => report.mock.calls.map(([action]) => action),
    commands,
    session: () => result.current,
    async awaiting() {
      await waitFor(() => expect(commands().pending?.phase).toBe('awaiting'));
      return commands().pending!;
    },
    async confirm(choice: CanvasConfirmationChoice) {
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

/** A Custom node type no Node uses. */
const laboratory: NodeType = {
  id: 'laboratory',
  name: 'Laboratorio',
  icon: 'FlaskConical',
  color: '#024AD8',
  isPredefined: false,
};

const withLaboratory: RoadmapDto = { ...roadmap, nodeTypes: [...roadmap.nodeTypes, laboratory] };

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

  test('deleting a Node shows its Change impact, deletes it and reports it applied', async () => {
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
    expect(canvas.onCommandApplied).toHaveBeenCalledExactlyOnceWith({
      kind: 'delete-node',
      nodeId: 'limits',
    });
  });

  test('cancelling an awaiting confirmation changes nothing and frees the slot', async () => {
    const canvas = await openCanvas();

    await act(() => canvas.commands().request({ kind: 'hide-node', nodeId: 'limits' }));
    await canvas.awaiting();
    act(() => canvas.commands().cancel());

    expect(canvas.commands().pending).toBeNull();
    expect(await nodeOf(canvas.persistence, 'limits')).toMatchObject({ isVisible: true });
    expect(successToasts()).toEqual([]);
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
      expect(successToasts()).toEqual([]);

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
      expect(successToasts()).toEqual([]);

      await canvas.confirm(kind);
      expect(canvas.commands().pending).toBeNull();
      expect((await persistence.load(teachingInput)).dependencies).toEqual([]);
    },
  );

  const confirmedActionRequests = [
    { kind: 'hide-node', nodeId: 'limits' },
    { kind: 'show-node', nodeId: 'series' },
    { kind: 'delete-node', nodeId: 'derivatives' },
    {
      kind: 'apply-automatic-layout',
      positions: [{ nodeId: 'limits', position: { x: 0, y: 200 } }],
      direction: 'LR',
    },
    { kind: 'delete-node-type', nodeTypeId: 'content' },
    { kind: 'reset-canvas-preview' },
  ] as const;

  test.each(confirmedActionRequests)(
    'keeps $kind as the only pending Confirmed action',
    async (first) => {
      const canvas = await openCanvas();
      await act(() => canvas.commands().request(first));
      const pending = await canvas.awaiting();

      for (const other of confirmedActionRequests) {
        await act(() => canvas.commands().request(other));
      }

      expect(canvas.commands().pending).toBe(pending);
    },
  );

  test('asks about the unsaved draft once, before the deletion claims the slot', async () => {
    let answer: (proceed: boolean) => void = () => undefined;
    const guardDraft = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)));
    const canvas = await openCanvas(undefined, { guardDraft });

    let deletion: Promise<boolean> = Promise.resolve(false);
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
      expect(successToasts()).toEqual([]);

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

  test('applying an automatic layout asks first, then moves every Node and reports it applied', async () => {
    const canvas = await openCanvas();
    const layout = {
      kind: 'apply-automatic-layout',
      positions: [
        { nodeId: 'limits', position: { x: 0, y: 200 } },
        { nodeId: 'derivatives', position: { x: 300, y: 200 } },
      ],
      direction: 'LR',
    } as const;

    await act(() => canvas.commands().request(layout));
    expect(canvas.commands().pending).toEqual({
      kind: 'apply-automatic-layout',
      request: layout,
      impact: null,
      phase: 'awaiting',
    });
    expect(await nodeOf(canvas.persistence, 'limits')).toMatchObject({ positionY: 0 });

    await canvas.confirm('auto-layout');

    expect(canvas.commands().pending).toBeNull();
    expect(await nodeOf(canvas.persistence, 'limits')).toMatchObject({
      positionX: 0,
      positionY: 200,
    });
    expect(await nodeOf(canvas.persistence, 'derivatives')).toMatchObject({
      positionX: 300,
      positionY: 200,
    });
    expect(canvas.onCommandApplied).toHaveBeenCalledExactlyOnceWith(layout);
  });

  test('an automatic layout with a failed move keeps the moved Nodes and stays open to retry', async () => {
    const adapter = createInMemoryRoadmapSessionPersistence(roadmap);
    const canvas = await openCanvas({
      ...adapter,
      async moveNode(input, nodeId, position) {
        if (nodeId === 'derivatives') throw new Error();
        return adapter.moveNode(input, nodeId, position);
      },
    });

    await act(() =>
      canvas.commands().request({
        kind: 'apply-automatic-layout',
        positions: [
          { nodeId: 'limits', position: { x: 0, y: 200 } },
          { nodeId: 'derivatives', position: { x: 300, y: 200 } },
        ],
        direction: 'LR',
      }),
    );
    await canvas.confirm('auto-layout');

    expect(canvas.commands().pending).toMatchObject({
      kind: 'apply-automatic-layout',
      phase: 'awaiting',
    });
    expect(await nodeOf(adapter, 'limits')).toMatchObject({ positionX: 0, positionY: 200 });
    expect(await nodeOf(adapter, 'derivatives')).toMatchObject({ positionX: 0, positionY: 0 });
    expect(canvas.session().error).toBe('No se pudo guardar la posición.');
    expect(successToasts()).toEqual([]);
    expect(canvas.onCommandApplied).not.toHaveBeenCalled();
  });

  test('resetting the Canvas preview asks first, then clears simulated Completions and reloads the preview', async () => {
    const canvas = await openCanvas();
    await act(async () => {
      await canvas.session().loadSimulation();
      await canvas.commands().request({ kind: 'complete-simulated-node', nodeId: 'limits' });
    });
    const simulatedCompletion = () =>
      canvas.session().simulationRoadmap?.nodes.find(({ id }) => id === 'limits');
    expect(simulatedCompletion()).toMatchObject({ isCompleted: true });

    await act(() => canvas.commands().request({ kind: 'reset-canvas-preview' }));
    expect(await canvas.awaiting()).toEqual({
      kind: 'reset-canvas-preview',
      request: { kind: 'reset-canvas-preview' },
      impact: null,
      phase: 'awaiting',
    });
    expect(simulatedCompletion()).toMatchObject({ isCompleted: true });

    await canvas.confirm('reset-canvas-preview');

    expect(canvas.commands().pending).toBeNull();
    expect(simulatedCompletion()).toMatchObject({ isCompleted: false });
    expect((await canvas.persistence.loadSimulation(teachingInput)).nodes[0]).toMatchObject({
      isCompleted: false,
    });
  });

  describe('Node type deletion', () => {
    const workshop: NodeType = {
      id: 'workshop',
      name: 'Taller',
      icon: 'Shapes',
      color: '#024AD8',
      isPredefined: false,
    };
    const withWorkshop = (usedBy?: string): RoadmapDto => ({
      ...roadmap,
      nodeTypes: [...roadmap.nodeTypes, workshop],
      nodes: roadmap.nodes.map((node) =>
        node.id === usedBy ? { ...node, nodeTypeId: workshop.id } : node,
      ),
    });
    const deleteWorkshop = { kind: 'delete-node-type', nodeTypeId: workshop.id } as const;
    const nodeTypeIds = async (persistence: RoadmapCanvasSessionPersistence) =>
      (await persistence.load(teachingInput)).nodeTypes.map(({ id }) => id);

    test('asks first and keeps the choice pending while the Node type is deleted', async () => {
      const adapter = createInMemoryRoadmapSessionPersistence(withWorkshop());
      let finishDeletion: () => void = () => undefined;
      const persistence: RoadmapCanvasSessionPersistence = {
        ...adapter,
        async deleteNodeType(...args) {
          await new Promise<void>((resolve) => (finishDeletion = resolve));
          return adapter.deleteNodeType(...args);
        },
      };
      const canvas = await openCanvas(persistence);

      await act(() => canvas.commands().request(deleteWorkshop));
      expect(await canvas.awaiting()).toEqual({
        kind: 'delete-node-type',
        request: deleteWorkshop,
        impact: null,
        phase: 'awaiting',
      });

      let confirmation: Promise<void> = Promise.resolve();
      act(() => {
        confirmation = canvas.commands().confirm('delete-node-type');
      });
      expect(canvas.commands().pending).toMatchObject({
        phase: 'confirming',
        choice: 'delete-node-type',
      });

      await act(async () => {
        finishDeletion();
        await confirmation;
      });
      expect(canvas.commands().pending).toBeNull();
      expect(await nodeTypeIds(persistence)).toEqual(['content']);
    });

    test('keeps the confirmation open with the refusal when Nodes still use the Node type', async () => {
      const canvas = await openCanvas(
        createInMemoryRoadmapSessionPersistence(withWorkshop('limits')),
      );

      await act(() => canvas.commands().request(deleteWorkshop));
      await canvas.awaiting();
      await canvas.confirm('delete-node-type');

      expect(canvas.session().error).toBe('No se puede eliminar un tipo utilizado por nodos.');
      expect(canvas.commands().pending).toMatchObject({
        kind: 'delete-node-type',
        phase: 'awaiting',
      });
      expect(await nodeTypeIds(canvas.persistence)).toEqual(['content', 'workshop']);
      expect(successToasts()).toEqual([]);
      expect(canvas.onCommandApplied).not.toHaveBeenCalled();
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

  describe('Confirmed action toasts', () => {
    test.each<
      [string, RoadmapDto, CanvasCommandOf<ConfirmedActionKind>, CanvasConfirmationChoice, string]
    >([
      [
        'hiding a Node',
        roadmap,
        { kind: 'hide-node', nodeId: 'limits' },
        'hide-node',
        'Nodo ocultado exitosamente.',
      ],
      [
        'showing a Node',
        roadmap,
        { kind: 'show-node', nodeId: 'series' },
        'show-node',
        'Nodo visible para estudiantes.',
      ],
      [
        'deleting a Node',
        roadmap,
        { kind: 'delete-node', nodeId: 'limits' },
        'delete-node',
        'Nodo eliminado exitosamente.',
      ],
      [
        'applying an automatic layout',
        roadmap,
        {
          kind: 'apply-automatic-layout',
          positions: [{ nodeId: 'limits', position: { x: 0, y: 200 } }],
          direction: 'LR',
        },
        'auto-layout',
        'Nodos ordenados exitosamente.',
      ],
      [
        'deleting a Custom node type',
        withLaboratory,
        { kind: 'delete-node-type', nodeTypeId: laboratory.id },
        'delete-node-type',
        'Tipo de nodo eliminado exitosamente.',
      ],
      [
        'resetting the Canvas preview',
        roadmap,
        { kind: 'reset-canvas-preview' },
        'reset-canvas-preview',
        'Progreso de previsualización reiniciado.',
      ],
      [
        'placing a Teacher block',
        roadmap,
        { kind: 'change-teacher-block', nodeId: 'limits', operation: 'BLOCK' },
        'block-teacher',
        'Nodo bloqueado exitosamente.',
      ],
      [
        'unlocking only the Node',
        withTeacherBlocks('limits', 'derivatives'),
        { kind: 'change-teacher-block', nodeId: 'limits', operation: 'UNBLOCK' },
        'unlock-node',
        'Nodo desbloqueado exitosamente.',
      ],
      [
        'a Branch unlock',
        withTeacherBlocks('limits', 'derivatives'),
        { kind: 'change-teacher-block', nodeId: 'limits', operation: 'UNBLOCK' },
        'unlock-branch',
        'Rama desbloqueada exitosamente.',
      ],
      [
        'unlocking behind a blocked prerequisite',
        withTeacherBlocks('limits', 'derivatives'),
        { kind: 'change-teacher-block', nodeId: 'derivatives', operation: 'UNBLOCK' },
        'unlock-prerequisites',
        'Nodos desbloqueados exitosamente.',
      ],
    ])('%s shows its toast only once confirmed', async (_, fixture, request, choice, toast) => {
      const canvas = await openCanvas(createInMemoryRoadmapSessionPersistence(fixture));

      await act(() => canvas.commands().request(request));
      await canvas.awaiting();
      expect(successToasts()).toEqual([]);
      await canvas.confirm(choice);

      expect(canvas.commands().pending).toBeNull();
      expect(canvas.session().error).toBeNull();
      expect(successToasts()).toEqual([toast]);
    });
  });

  describe('unconfirmed writes', () => {
    const guide = { id: 'guide', title: 'Guía', url: 'https://example.test/guia', type: 'LINK' };
    /** Límites is Teacher-blocked, so it can be scheduled, and links a guide; Laboratorio is a Custom node type. */
    const editable: RoadmapDto = {
      ...withTeacherBlocks('limits'),
      nodeTypes: [...roadmap.nodeTypes, laboratory],
      nodes: withTeacherBlocks('limits').nodes.map((node) =>
        node.id === 'limits' ? { ...node, resources: [guide] as RoadmapNode['resources'] } : node,
      ),
    };
    const limits = async (persistence: RoadmapCanvasSessionPersistence) =>
      (await nodeOf(persistence, 'limits')) as RoadmapNode;
    const scheduledUnlock = async (persistence: RoadmapCanvasSessionPersistence) => {
      const node = await limits(persistence);
      return 'teacherUnlockOn' in node ? node.teacherUnlockOn : undefined;
    };
    const workshop = { name: 'Taller', icon: 'Shapes', color: '#024AD8' } as const;

    test.each<
      [
        string,
        UnconfirmedCommand,
        string | null,
        (persistence: RoadmapCanvasSessionPersistence) => Promise<unknown>,
        unknown,
      ]
    >([
      [
        'saving a Node',
        {
          kind: 'update-node',
          nodeId: 'limits',
          value: { title: 'Límites y continuidad', description: '', nodeTypeId: 'content' },
        },
        'Cambios guardados exitosamente.',
        async (persistence) => (await limits(persistence)).title,
        'Límites y continuidad',
      ],
      [
        'adding a link',
        {
          kind: 'add-resource',
          nodeId: 'limits',
          resource: { title: 'Apuntes', url: 'https://example.test/apuntes', type: 'LINK' },
        },
        'Enlace guardado exitosamente.',
        async (persistence) => (await limits(persistence)).resources.map(({ title }) => title),
        ['Guía', 'Apuntes'],
      ],
      [
        'uploading a file',
        {
          kind: 'upload-resource',
          nodeId: 'limits',
          file: new File(['contenido'], 'apuntes.pdf', { type: 'application/pdf' }),
        },
        'Recurso guardado exitosamente.',
        async (persistence) => (await limits(persistence)).resources.map(({ title }) => title),
        ['Guía', 'apuntes.pdf'],
      ],
      [
        'saving a link',
        {
          kind: 'update-resource',
          resourceId: 'guide',
          resource: { title: 'Guía actualizada', url: guide.url, type: 'LINK' },
        },
        'Enlace guardado exitosamente.',
        async (persistence) => (await limits(persistence)).resources[0].title,
        'Guía actualizada',
      ],
      [
        'saving a file',
        {
          kind: 'update-resource',
          resourceId: 'guide',
          resource: { title: 'Guía', url: 'guia.pdf', type: 'FILE' },
        },
        'Recurso guardado exitosamente.',
        async (persistence) => (await limits(persistence)).resources[0].type,
        'FILE',
      ],
      [
        'deleting a Resource',
        { kind: 'delete-resource', resourceId: 'guide' },
        'Recurso eliminado exitosamente.',
        async (persistence) => (await limits(persistence)).resources,
        [],
      ],
      [
        'scheduling an unlock',
        { kind: 'schedule-teacher-unlock', nodeId: 'limits', unlockOn: '2099-03-01' },
        'Desbloqueo programado.',
        scheduledUnlock,
        '2099-03-01',
      ],
      [
        'cancelling a Scheduled unlock',
        { kind: 'schedule-teacher-unlock', nodeId: 'limits', unlockOn: null },
        'Desbloqueo programado cancelado.',
        scheduledUnlock,
        undefined,
      ],
      [
        'moving Nodes',
        {
          kind: 'move-nodes',
          positions: [
            { nodeId: 'limits', position: { x: 40, y: 80 } },
            { nodeId: 'derivatives', position: { x: 240, y: 80 } },
          ],
        },
        null,
        async (persistence) =>
          (await persistence.load(teachingInput)).nodes
            .slice(0, 2)
            .map(({ positionX, positionY }) => [positionX, positionY]),
        [
          [40, 80],
          [240, 80],
        ],
      ],
      [
        'creating a Node',
        {
          kind: 'add-node',
          node: { title: 'Sucesiones', description: '', nodeTypeId: 'content', isVisible: true },
          position: { x: 480, y: 240 },
        },
        'Nodo creado exitosamente.',
        async (persistence) => (await persistence.load(teachingInput)).nodes.at(-1)?.title,
        'Sucesiones',
      ],
      [
        'creating a Node type',
        { kind: 'add-node-type', nodeType: workshop },
        'Tipo de nodo creado exitosamente.',
        async (persistence) =>
          (await persistence.load(teachingInput)).nodeTypes.map(({ name }) => name),
        ['Contenido', 'Laboratorio', 'Taller'],
      ],
      [
        'saving a Custom node type',
        { kind: 'update-node-type', nodeTypeId: laboratory.id, nodeType: workshop },
        'Tipo de nodo guardado exitosamente.',
        async (persistence) =>
          (await persistence.load(teachingInput)).nodeTypes.map(({ name }) => name),
        ['Contenido', 'Taller'],
      ],
      [
        'completing a Node',
        { kind: 'complete-node', nodeId: 'limits' },
        'Nodo completado.',
        async () => null,
        null,
      ],
    ])('%s applies at once and shows its toast', async (_, command, toast, read, expected) => {
      const canvas = await openCanvas(createInMemoryRoadmapSessionPersistence(editable));

      let applied: boolean | undefined;
      await act(async () => {
        applied = await canvas.commands().request(command);
      });

      expect(applied).toBe(true);
      expect(canvas.commands().pending).toBeNull();
      expect(canvas.session().error).toBeNull();
      expect(await read(canvas.persistence)).toEqual(expected);
      expect(successToasts()).toEqual(toast ? [toast] : []);
      expect(canvas.onCommandApplied).toHaveBeenCalledOnce();
    });

    test('a refused write shows the refusal as the session error, without toast or report', async () => {
      const canvas = await openCanvas();

      let applied: boolean | undefined;
      await act(async () => {
        applied = await canvas.commands().request({
          kind: 'update-node-type',
          nodeTypeId: 'content',
          nodeType: workshop,
        });
      });

      expect(applied).toBe(false);
      expect(canvas.session().error).toBe('Los tipos predefinidos son inmutables.');
      expect((await canvas.persistence.load(teachingInput)).nodeTypes[0].name).toBe('Contenido');
      expect(successToasts()).toEqual([]);
      expect(canvas.reported()).toEqual([]);
      expect(canvas.onCommandApplied).not.toHaveBeenCalled();
    });

    test('a failed write without a message shows its fallback as the session error', async () => {
      const adapter = createInMemoryRoadmapSessionPersistence(editable);
      const canvas = await openCanvas({
        ...adapter,
        addResource: async () => {
          throw new Error();
        },
      });

      let applied: boolean | undefined;
      await act(async () => {
        applied = await canvas.commands().request({
          kind: 'add-resource',
          nodeId: 'limits',
          resource: { title: 'Apuntes', url: 'https://example.test/apuntes', type: 'LINK' },
        });
      });

      expect(applied).toBe(false);
      expect(canvas.session().error).toBe('No se pudo agregar el recurso.');
      expect(successToasts()).toEqual([]);
      expect(canvas.reported()).toEqual([]);
    });

    test('requesting an unconfirmed write applies it at once, without a pending confirmation', async () => {
      const canvas = await openCanvas();

      await act(() =>
        canvas.commands().request({
          kind: 'move-nodes',
          positions: [{ nodeId: 'limits', position: { x: 40, y: 80 } }],
        }),
      );

      expect(canvas.commands().pending).toBeNull();
      expect(await nodeOf(canvas.persistence, 'limits')).toMatchObject({
        positionX: 40,
        positionY: 80,
      });
    });

    test('moves each Node on its own: a failed move keeps the others and shows its failure', async () => {
      const adapter = createInMemoryRoadmapSessionPersistence(roadmap);
      const canvas = await openCanvas({
        ...adapter,
        async moveNode(input, nodeId, position) {
          if (nodeId === 'derivatives') throw new Error();
          // The successful move settles after the failure.
          await new Promise((resolve) => setTimeout(resolve, 20));
          return adapter.moveNode(input, nodeId, position);
        },
      });

      let applied: boolean | undefined;
      await act(async () => {
        applied = await canvas.commands().request({
          kind: 'move-nodes',
          positions: [
            { nodeId: 'limits', position: { x: 40, y: 80 } },
            { nodeId: 'derivatives', position: { x: 300, y: 80 } },
          ],
        });
      });

      expect(applied).toBe(false);
      expect(await nodeOf(adapter, 'limits')).toMatchObject({ positionX: 40, positionY: 80 });
      expect(await nodeOf(adapter, 'derivatives')).toMatchObject({ positionX: 0, positionY: 0 });
      expect(canvas.session().error).toBe('No se pudo guardar la posición.');
      expect(canvas.onCommandApplied).not.toHaveBeenCalled();
    });

    test('creating a Node tells the view and the Practice roadmap which Node it created', async () => {
      const canvas = await openCanvas();
      const command = {
        kind: 'add-node',
        node: { title: 'Sucesiones', description: '', nodeTypeId: 'content', isVisible: true },
        position: { x: 480, y: 240 },
      } as const;

      await act(() => canvas.commands().request(command));

      const created = (await canvas.persistence.load(teachingInput)).nodes.at(-1)!;
      expect(created).toMatchObject({ title: 'Sucesiones', positionX: 480, positionY: 240 });
      expect(canvas.session().roadmap?.nodes.at(-1)?.id).toBe(created.id);
      expect(canvas.onCommandApplied).toHaveBeenCalledExactlyOnceWith(command, created.id);
      expect(canvas.reported()).toEqual([{ type: 'addNode', nodeId: created.id }]);
    });

    test('completing a Node in the Canvas preview reloads only the preview, shows the student toast and reports it', async () => {
      const canvas = await openCanvas();
      await act(async () => {
        await canvas.session().loadSimulation();
      });

      await act(() =>
        canvas.commands().request({ kind: 'complete-simulated-node', nodeId: 'limits' }),
      );

      expect(
        canvas.session().simulationRoadmap?.nodes.find(({ id }) => id === 'limits'),
      ).toMatchObject({ isCompleted: true });
      expect(await nodeOf(canvas.persistence, 'limits')).not.toHaveProperty('isCompleted');
      expect(successToasts()).toEqual(['Nodo completado.']);
      expect(canvas.reported()).toEqual([{ type: 'completeSimulatedNode', nodeId: 'limits' }]);
    });
  });

  describe('Practice reports', () => {
    test('reports each confirmed outcome once it took effect, with the operation chosen', async () => {
      const canvas = await openCanvas(
        createInMemoryRoadmapSessionPersistence(withTeacherBlocks('derivatives')),
      );
      const confirmed = async (
        command: CanvasCommandOf<ConfirmedActionKind>,
        choice: CanvasConfirmationChoice,
      ) => {
        await act(() => canvas.commands().request(command));
        await canvas.awaiting();
        await canvas.confirm(choice);
      };

      await act(() => canvas.commands().request({ kind: 'hide-node', nodeId: 'limits' }));
      await canvas.awaiting();
      act(() => canvas.commands().cancel());
      expect(canvas.reported()).toEqual([]);

      await confirmed({ kind: 'hide-node', nodeId: 'integrals' }, 'hide-node');
      await confirmed({ kind: 'show-node', nodeId: 'integrals' }, 'show-node');
      await confirmed(
        { kind: 'change-teacher-block', nodeId: 'derivatives', operation: 'UNBLOCK' },
        'unlock-branch',
      );
      await act(() =>
        canvas.commands().request({
          kind: 'create-dependency',
          sourceNodeId: 'limits',
          targetNodeId: 'integrals',
          sourceHandle: 'right',
          targetHandle: 'left',
        }),
      );
      await confirmed({ kind: 'delete-node', nodeId: 'series' }, 'delete-node');

      expect(canvas.reported()).toEqual([
        { type: 'changeVisibility', nodeId: 'integrals', isVisible: false },
        { type: 'changeVisibility', nodeId: 'integrals', isVisible: true },
        { type: 'changeTeacherBlock', nodeId: 'derivatives', operation: 'BRANCH_UNLOCK' },
        { type: 'connectNodes', sourceNodeId: 'limits', targetNodeId: 'integrals' },
        { type: 'deleteNode', nodeId: 'series' },
      ]);
    });

    test('reports a simulated Completion whose preview reload a newer one superseded', async () => {
      const adapter = createInMemoryRoadmapSessionPersistence(roadmap);
      let holdNextPreviewLoad = false;
      let releasePreviewLoad: (() => void) | undefined;
      const canvas = await openCanvas({
        ...adapter,
        async loadSimulation(input) {
          if (holdNextPreviewLoad) {
            holdNextPreviewLoad = false;
            await new Promise<void>((resolve) => (releasePreviewLoad = resolve));
          }
          return adapter.loadSimulation(input);
        },
      });
      await act(async () => {
        await canvas.session().loadSimulation();
      });

      holdNextPreviewLoad = true;
      let completion: Promise<boolean> | undefined;
      act(() => {
        completion = canvas.commands().request({
          kind: 'complete-simulated-node',
          nodeId: 'limits',
        });
      });
      await waitFor(() => expect(releasePreviewLoad).toBeDefined());
      await act(async () => {
        await canvas.session().loadSimulation();
      });
      let applied: boolean | undefined;
      await act(async () => {
        releasePreviewLoad!();
        applied = await completion;
      });

      expect(applied).toBe(true);
      expect(canvas.session().error).toBeNull();
      expect(
        canvas.session().simulationRoadmap?.nodes.find(({ id }) => id === 'limits'),
      ).toMatchObject({ isCompleted: true });
      expect(canvas.reported()).toEqual([{ type: 'completeSimulatedNode', nodeId: 'limits' }]);
    });

    test('a confirmed write whose Roadmap reload fails still took effect: it is reported and the reload failure shown', async () => {
      const adapter = createInMemoryRoadmapSessionPersistence(roadmap);
      let failLoads = false;
      const canvas = await openCanvas({
        ...adapter,
        async load(input) {
          if (failLoads) throw new Error();
          return adapter.load(input);
        },
      });

      await act(() => canvas.commands().request({ kind: 'hide-node', nodeId: 'integrals' }));
      await canvas.awaiting();
      failLoads = true;
      await canvas.confirm('hide-node');

      expect(canvas.commands().pending).toBeNull();
      expect(await nodeOf(adapter, 'integrals')).toMatchObject({ isVisible: false });
      expect(canvas.reported()).toEqual([
        { type: 'changeVisibility', nodeId: 'integrals', isVisible: false },
      ]);
      expect(canvas.onCommandApplied).toHaveBeenCalledExactlyOnceWith({
        kind: 'hide-node',
        nodeId: 'integrals',
      });
      expect(canvas.session().error).toBe('No se pudo actualizar el roadmap. Puedes reintentar.');
    });

    test('reports entering the Canvas preview once per entry, not on every preview reload', async () => {
      const canvas = await openCanvas();
      const preview = () => canvas.session().canvasPreviewWorkflow;
      const enter = async () => {
        await act(async () => preview().requestEntry());
        await waitFor(() => expect(preview().isActive).toBe(true));
      };

      await enter();
      await act(() =>
        canvas.commands().request({ kind: 'complete-simulated-node', nodeId: 'limits' }),
      );
      // A Roadmap change reloads the Canvas preview too.
      await act(() =>
        canvas.commands().request({
          kind: 'move-nodes',
          positions: [{ nodeId: 'limits', position: { x: 1, y: 1 } }],
        }),
      );
      act(() => preview().exit());
      await enter();

      expect(canvas.reported()).toEqual([
        { type: 'enterCanvasPreview' },
        { type: 'completeSimulatedNode', nodeId: 'limits' },
        { type: 'enterCanvasPreview' },
      ]);
    });
  });
});
