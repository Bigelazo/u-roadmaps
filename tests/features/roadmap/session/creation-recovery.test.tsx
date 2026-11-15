import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import { UncertainNodeCreationError } from '@/features/roadmap/session/placement-recovery';
import { createNodeWithResources } from '@/features/roadmap/session/node-creation';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';
import type { RoadmapDto } from '@/features/roadmap/types';
import { useTestCanvasSession } from '../support/use-test-canvas-session';

const input = {
  courseOffering: {
    identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
    title: 'Cálculo',
  },
  experience: { kind: 'teaching' as const, term: 'current' as const },
};

const roadmap: RoadmapDto = {
  roadmap: { id: 'roadmap' },
  nodeTypes: [
    { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
  ],
  nodes: [
    {
      id: 'first',
      title: 'Límites',
      description: null,
      nodeTypeId: 'content',
      positionX: 0,
      positionY: 0,
      isVisible: true,
      isTeacherBlocked: false,
      resources: [],
    },
  ],
  dependencies: [],
};

function move(x: number) {
  return { kind: 'move-nodes' as const, positions: [{ nodeId: 'first', position: { x, y: 0 } }] };
}

async function openCanvas(persistence: RoadmapCanvasSessionPersistence) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
      {children}
    </RoadmapCanvasSessionPersistenceProvider>
  );
  const view = renderHook(() => useTestCanvasSession(input), { wrapper });
  await waitFor(() => expect(view.result.current.roadmap).not.toBeNull());
  return view;
}

const creation = {
  kind: 'add-node' as const,
  nodeId: 'pending-node',
  node: { title: 'Nuevo', description: '', nodeTypeId: 'content', isVisible: true },
  position: { x: 0, y: 200 },
  displaced: [{ nodeId: 'first', position: { x: 80, y: 0 } }],
};

test('a committed creation with a lost response recovers its exact identity and current saved state', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  const canvas = await openCanvas({
    ...saved,
    async execute(command, previewVersion) {
      const result = await saved.execute(command, previewVersion);
      if (command.kind === 'add-node') {
        await saved.execute(move(180));
        await saved.execute({
          kind: 'update-node',
          nodeId: command.nodeId,
          value: { title: 'Editado después', description: '', nodeTypeId: 'content' },
        });
        throw new UncertainNodeCreationError();
      }
      return result;
    },
  });
  let outcome: unknown;
  await act(async () => {
    outcome = await canvas.result.current.canvasCommands.run(creation);
  });
  expect(outcome).toMatchObject({ applied: true, createdNodeId: 'pending-node' });
  expect(canvas.result.current.roadmap?.nodes).toContainEqual(
    expect.objectContaining({ id: 'pending-node', title: 'Editado después' }),
  );
  expect(canvas.result.current.roadmap?.nodes[0].positionX).toBe(180);
  expect((await saved.load()).nodes).toHaveLength(2);
});

test('unavailable recovery preserves uncertainty, discards dependent movement and permits explicit same-identity resend before attachments', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  let unavailable = false;
  let loseResponse = true;
  let creationSubmissions = 0;
  const canvas = await openCanvas({
    ...saved,
    async load() {
      if (unavailable) throw new Error('Sin conexión');
      return saved.load();
    },
    async execute(command, previewVersion) {
      if (command.kind === 'add-node') creationSubmissions += 1;
      const result = await saved.execute(command, previewVersion);
      if (command.kind === 'add-node' && loseResponse) {
        loseResponse = false;
        unavailable = true;
        throw new UncertainNodeCreationError();
      }
      return result;
    },
  });
  const resources = [
    {
      id: 'resource-draft',
      type: 'LINK' as const,
      title: 'Guía',
      url: 'https://example.test/guide',
    },
  ];
  let first!: ReturnType<typeof createNodeWithResources>;
  let dependent!: Promise<unknown>;
  await act(async () => {
    first = createNodeWithResources(canvas.result.current.canvasCommands.run, creation, resources);
    dependent = canvas.result.current.canvasCommands.run(move(400));
    await Promise.all([first, dependent]);
  });
  expect(await first).toBeNull();
  expect(canvas.result.current.placementRecovery).toMatchObject({ kind: 'uncertain-creation' });
  expect((await saved.load()).nodes[0].positionX).toBe(80);
  expect((await saved.load()).nodes).toContainEqual(
    expect.objectContaining({ id: creation.nodeId, resources: [] }),
  );
  await act(async () => {
    await canvas.result.current.canvasCommands.run(move(500));
  });
  expect((await saved.load()).nodes[0].positionX).toBe(80);
  await saved.execute(move(180));
  unavailable = false;
  let recovered: unknown;
  await act(async () => {
    recovered = await createNodeWithResources(
      canvas.result.current.canvasCommands.run,
      creation,
      resources,
    );
  });
  expect(recovered).toMatchObject({ nodeId: creation.nodeId, failed: [] });
  expect(creationSubmissions).toBe(2);
  expect((await saved.load()).nodes).toHaveLength(2);
  expect((await saved.load()).nodes[0].positionX).toBe(180);
  expect((await saved.load()).nodes).toContainEqual(
    expect.objectContaining({
      id: creation.nodeId,
      resources: [expect.objectContaining({ title: 'Guía' })],
    }),
  );
  expect(canvas.result.current.placementRecovery).toBeNull();
});

test('a successful read with no matching identity does not infer creation from matching content or resend automatically', async () => {
  const saved = createInMemoryRoadmapSessionPersistence({
    ...roadmap,
    nodes: [
      ...roadmap.nodes,
      {
        ...roadmap.nodes[0],
        id: 'different-attempt',
        title: creation.node.title,
        positionX: creation.position.x,
        positionY: creation.position.y,
      },
    ],
  });
  let submissions = 0;
  const canvas = await openCanvas({
    ...saved,
    async execute() {
      submissions += 1;
      throw new UncertainNodeCreationError();
    },
  });
  let outcome: unknown;
  await act(async () => {
    outcome = await canvas.result.current.canvasCommands.run(creation);
  });
  expect(outcome).toMatchObject({ applied: false, creationUncertain: true });
  expect(canvas.result.current.placementRecovery?.kind).toBe('uncertain-creation');
  await act(async () => {
    await canvas.result.current.recoverPlacement();
  });
  expect(canvas.result.current.placementRecovery?.kind).toBe('uncertain-creation');
  expect(submissions).toBe(1);
  expect((await saved.load()).nodes).not.toContainEqual(
    expect.objectContaining({ id: creation.nodeId }),
  );
});

test.for(['response', 'rejection'] as const)(
  'leaving during attachment stops the remaining progress and Resource continuation after a late %s',
  async (outcome) => {
    const saved = createInMemoryRoadmapSessionPersistence(roadmap);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const submitting = new Promise<void>((resolve) => {
      started = resolve;
    });
    const canvas = await openCanvas({
      ...saved,
      async execute(command, previewVersion) {
        const result = await saved.execute(command, previewVersion);
        if (command.kind === 'add-resource') {
          started();
          await pending;
          if (outcome === 'rejection') throw new Error('Respuesta perdida');
        }
        return result;
      },
    });
    const resources = [1, 2].map((index) => ({
      id: `draft-${index}`,
      type: 'LINK' as const,
      title: `Guía ${index}`,
      url: `https://example.test/${index}`,
    }));
    const progress: number[] = [];
    let workflow!: ReturnType<typeof createNodeWithResources>;
    act(() => {
      workflow = createNodeWithResources(
        canvas.result.current.canvasCommands.run,
        creation,
        resources,
        ({ current }) => progress.push(current),
      );
    });
    await act(async () => {
      await submitting;
    });
    canvas.unmount();
    release();
    expect(await workflow).toBeNull();
    expect(progress).toEqual([1]);
    expect((await saved.load()).nodes).toContainEqual(
      expect.objectContaining({
        id: creation.nodeId,
        resources: [expect.objectContaining({ title: 'Guía 1' })],
      }),
    );
  },
);

test('a committed placement whose authoritative reload fails discards queued positions before pausing', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  let unavailable = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const canvas = await openCanvas({
    ...saved,
    async load() {
      if (unavailable) throw new Error('Sin conexión');
      return saved.load();
    },
    async execute(command, previewVersion) {
      await pending;
      const result = await saved.execute(command, previewVersion);
      unavailable = true;
      return result;
    },
  });
  let first!: Promise<unknown>;
  let later!: Promise<unknown>;
  act(() => {
    first = canvas.result.current.canvasCommands.run(move(80));
    later = canvas.result.current.canvasCommands.run(move(400));
  });
  await act(async () => {
    release();
    await Promise.all([first, later]);
  });
  expect((await saved.load()).nodes[0].positionX).toBe(80);
  expect(canvas.result.current.placementRecovery?.kind).toBe('unsynchronized');
});

test('leaving between an attachment acknowledgement and its continuation stops further Resources and feedback', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  const canvas = await openCanvas(saved);
  const resources = [1, 2].map((index) => ({
    id: `draft-${index}`,
    type: 'LINK' as const,
    title: `Guía ${index}`,
    url: `https://example.test/${index}`,
  }));
  const progress: number[] = [];
  const run: typeof canvas.result.current.canvasCommands.run = async (command, options) => {
    const result = await canvas.result.current.canvasCommands.run(command, options);
    if (command.kind === 'add-resource') canvas.unmount();
    return result;
  };
  const isActive = canvas.result.current.isActive;
  let outcome: unknown;
  await act(async () => {
    outcome = await createNodeWithResources(
      run,
      creation,
      resources,
      ({ current }) => progress.push(current),
      isActive,
    );
  });
  expect(outcome).toBeNull();
  expect(progress).toEqual([1]);
  expect((await saved.load()).nodes).toContainEqual(
    expect.objectContaining({
      id: creation.nodeId,
      resources: [expect.objectContaining({ title: 'Guía 1' })],
    }),
  );
});

test('a later authoritative identity lookup confirms the creation without resubmission and waits for explicit attachment continuation', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  let submissions = 0;
  const canvas = await openCanvas({
    ...saved,
    async execute(command, previewVersion) {
      if (command.kind === 'add-node') {
        submissions += 1;
        throw new UncertainNodeCreationError();
      }
      return saved.execute(command, previewVersion);
    },
  });
  await act(async () => {
    await canvas.result.current.canvasCommands.run(creation);
  });
  await saved.execute(creation);
  await act(async () => {
    await canvas.result.current.recoverPlacement();
  });
  expect(canvas.result.current.placementRecovery?.kind).toBe('recovered-creation');
  expect((await saved.load()).nodes).toContainEqual(
    expect.objectContaining({ id: creation.nodeId, resources: [] }),
  );
  const resources = [
    {
      id: 'resource-draft',
      type: 'LINK' as const,
      title: 'Guía',
      url: 'https://example.test/guide',
    },
  ];
  let outcome: unknown;
  await act(async () => {
    outcome = await createNodeWithResources(
      canvas.result.current.canvasCommands.run,
      creation,
      resources,
    );
  });
  expect(outcome).toMatchObject({ nodeId: creation.nodeId, failed: [] });
  expect(submissions).toBe(1);
  expect((await saved.load()).nodes).toContainEqual(
    expect.objectContaining({
      id: creation.nodeId,
      resources: [expect.objectContaining({ title: 'Guía' })],
    }),
  );
});

test('leaving during uncertain identity recovery suppresses attachment continuation and keeps the next session isolated', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  let recovering = false;
  let started!: () => void;
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = await openCanvas({
    ...saved,
    async load() {
      if (recovering) {
        started();
        await pending;
      }
      return saved.load();
    },
    async execute(command, previewVersion) {
      const result = await saved.execute(command, previewVersion);
      if (command.kind === 'add-node') {
        recovering = true;
        throw new UncertainNodeCreationError();
      }
      return result;
    },
  });
  const resources = [
    {
      id: 'resource-draft',
      type: 'LINK' as const,
      title: 'Guía',
      url: 'https://example.test/guide',
    },
  ];
  let workflow!: ReturnType<typeof createNodeWithResources>;
  act(() => {
    workflow = createNodeWithResources(
      previous.result.current.canvasCommands.run,
      creation,
      resources,
    );
  });
  await act(async () => {
    await reading;
  });
  previous.unmount();
  const next = await openCanvas(
    createInMemoryRoadmapSessionPersistence({
      ...roadmap,
      nodes: [{ ...roadmap.nodes[0], title: 'Otro curso' }],
    }),
  );
  await act(async () => {
    release();
    await workflow;
  });
  expect(await workflow).toBeNull();
  expect((await saved.load()).nodes).toContainEqual(
    expect.objectContaining({ id: creation.nodeId, resources: [] }),
  );
  expect(next.result.current.roadmap?.nodes[0].title).toBe('Otro curso');
  expect(next.result.current.error).toBeNull();
  expect(next.result.current.placementRecovery).toBeNull();
});
