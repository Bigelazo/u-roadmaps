import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { createInMemoryRoadmapSessionPersistence } from '@/features/roadmap/session/in-memory-persistence';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';
import type { AnyRoadmapDto, RoadmapDto } from '@/features/roadmap/types';
import { canvasConfirmationChoices } from '@/features/roadmap/ui/roadmap-confirmation';
import { createNodeWithResources } from '@/features/roadmap/session/node-creation';
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
    {
      id: 'second',
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
  dependencies: [],
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function move(x: number, nodeId = 'first') {
  return { kind: 'move-nodes' as const, positions: [{ nodeId, position: { x, y: 0 } }] };
}

async function openCanvas(
  persistence: RoadmapCanvasSessionPersistence,
  entryRoadmap?: Promise<AnyRoadmapDto | null>,
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
      {children}
    </RoadmapCanvasSessionPersistenceProvider>
  );
  const view = renderHook(({ entryRoadmap }) => useTestCanvasSession({ ...input, entryRoadmap }), {
    wrapper,
    initialProps: { entryRoadmap },
  });
  await waitFor(() => expect(view.result.current.roadmap).not.toBeNull());
  return view;
}

test.for(['movement', 'automatic layout'] as const)(
  'rapid %s saves in gesture order while the newer position stays immediate',
  async (gesture) => {
    const saved = createInMemoryRoadmapSessionPersistence(roadmap);
    const submitted = deferred();
    const release = deferred();
    let first = true;
    const canvas = await openCanvas({
      ...saved,
      async execute(command, previewVersion) {
        if (first) {
          first = false;
          submitted.resolve();
          await release.promise;
        }
        return saved.execute(command, previewVersion);
      },
    });
    let earlier!: ReturnType<typeof canvas.result.current.canvasCommands.run>;
    let later!: Promise<unknown>;
    act(() => {
      earlier = canvas.result.current.canvasCommands.run(move(20));
    });
    await submitted.promise;
    if (gesture === 'movement')
      act(() => {
        later = canvas.result.current.canvasCommands.run(move(40));
      });
    else {
      const positions = [{ nodeId: 'first', position: { x: 40, y: 0 } }];
      await act(async () => {
        await canvas.result.current.canvasCommands.request({
          kind: 'apply-automatic-layout',
          layouts: { TB: positions, LR: positions },
        });
      });
      act(() => {
        later = canvas.result.current.canvasCommands.confirm(
          canvasConfirmationChoices.autoLayoutHorizontal,
        );
      });
    }
    await waitFor(() => expect(canvas.result.current.roadmap?.nodes[0].positionX).toBe(40));
    expect((await saved.load()).nodes[0].positionX).toBe(0);
    await act(async () => {
      release.resolve();
      await Promise.all([earlier, later]);
    });
    expect((await saved.load()).nodes[0].positionX).toBe(40);
    expect(canvas.result.current.roadmap?.nodes[0].positionX).toBe(40);
  },
);

test('a failed placement discards dependent unsent gestures and reloads another teacher’s current positions', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  const submitted = deferred();
  const release = deferred();
  let first = true;
  const canvas = await openCanvas({
    ...saved,
    async execute(command, previewVersion) {
      if (first) {
        first = false;
        submitted.resolve();
        await release.promise;
        throw new Error('No se pudo guardar la posición.');
      }
      return saved.execute(command, previewVersion);
    },
  });
  let earlier!: ReturnType<typeof canvas.result.current.canvasCommands.run>;
  let later!: typeof earlier;
  act(() => {
    earlier = canvas.result.current.canvasCommands.run(move(20));
  });
  await submitted.promise;
  act(() => {
    later = canvas.result.current.canvasCommands.run(move(60));
  });
  await saved.execute(move(180, 'second'));
  await act(async () => {
    release.resolve();
    await Promise.all([earlier, later]);
  });
  expect((await saved.load()).nodes.map(({ positionX }) => positionX)).toEqual([0, 180]);
  expect(canvas.result.current.roadmap?.nodes.map(({ positionX }) => positionX)).toEqual([0, 180]);
  expect(canvas.result.current.error).toBe('No se pudo guardar la posición.');
  await act(async () => {
    await canvas.result.current.canvasCommands.run(move(80));
  });
  expect((await saved.load()).nodes[0].positionX).toBe(80);
});

test('a new streamed entry snapshot preserves newer pending placement and the mounted session queue', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  const submitted = deferred();
  const release = deferred();
  let first = true;
  const canvas = await openCanvas(
    {
      ...saved,
      async execute(command, previewVersion) {
        if (first) {
          first = false;
          submitted.resolve();
          await release.promise;
        }
        return saved.execute(command, previewVersion);
      },
    },
    Promise.resolve(roadmap),
  );
  let earlier!: ReturnType<typeof canvas.result.current.canvasCommands.run>;
  let later!: typeof earlier;
  act(() => {
    earlier = canvas.result.current.canvasCommands.run(move(20));
  });
  await submitted.promise;
  act(() => {
    later = canvas.result.current.canvasCommands.run(move(40));
  });
  await waitFor(() => expect(canvas.result.current.roadmap?.nodes[0].positionX).toBe(40));
  await saved.execute({
    kind: 'update-node',
    nodeId: 'first',
    value: { title: 'Contenido actualizado', description: '', nodeTypeId: 'content' },
  });
  const entered = await saved.load();
  canvas.rerender({ entryRoadmap: Promise.resolve(entered) });
  await waitFor(() =>
    expect(canvas.result.current.roadmap?.nodes[0].title).toBe('Contenido actualizado'),
  );
  try {
    expect(canvas.result.current.roadmap?.nodes[0].positionX).toBe(40);
  } finally {
    await act(async () => {
      release.resolve();
      await Promise.all([earlier, later]);
    });
  }
  expect((await saved.load()).nodes[0].positionX).toBe(40);
});

test('a new authoritative entry snapshot recovers a blocked placement session without a duplicate initial read', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  let unavailable = false;
  let reject = true;
  let reads = 0;
  const canvas = await openCanvas(
    {
      ...saved,
      async load() {
        reads += 1;
        if (unavailable) throw new Error('Sin conexión');
        return saved.load();
      },
      async execute(command, previewVersion) {
        if (reject) {
          reject = false;
          unavailable = true;
          throw new Error('No se pudo guardar la posición.');
        }
        return saved.execute(command, previewVersion);
      },
    },
    Promise.resolve(roadmap),
  );
  expect(reads).toBe(0);
  await act(async () => {
    await canvas.result.current.canvasCommands.run(move(20));
  });
  expect(canvas.result.current.placementRecovery?.kind).toBe('unsynchronized');
  await saved.execute(move(180));
  const entered = await saved.load();
  canvas.rerender({ entryRoadmap: Promise.resolve(entered) });
  await waitFor(() => expect(canvas.result.current.roadmap?.nodes[0].positionX).toBe(180));
  expect(canvas.result.current.placementRecovery).toBeNull();
  unavailable = false;
  await act(async () => {
    await canvas.result.current.canvasCommands.run(move(80));
  });
  expect((await saved.load()).nodes[0].positionX).toBe(80);
});

test('failed recovery keeps explicit unsynchronized feedback and refuses placements until authoritative reload succeeds', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  let unavailable = false;
  let unavailableReads = 0;
  const retriedRecovery = deferred();
  let failNext = true;
  const canvas = await openCanvas({
    ...saved,
    async load() {
      if (unavailable) {
        unavailableReads += 1;
        if (unavailableReads === 2) retriedRecovery.resolve();
        throw new Error('Sin conexión.');
      }
      return saved.load();
    },
    async execute(command, previewVersion) {
      if (failNext) {
        failNext = false;
        unavailable = true;
        throw new Error('No se pudo guardar la posición.');
      }
      return saved.execute(command, previewVersion);
    },
  });
  await act(async () => {
    await canvas.result.current.canvasCommands.run(move(20));
  });
  expect(canvas.result.current.error).toContain('No se pudo sincronizar');
  act(() => {
    canvas.result.current.dismissError();
  });
  expect(canvas.result.current.error).toContain('No se pudo sincronizar');
  await act(async () => {
    expect(await canvas.result.current.canvasCommands.run(move(60))).toEqual({ applied: false });
  });
  expect((await saved.load()).nodes[0].positionX).toBe(0);
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
    await retriedRecovery.promise;
  });
  expect(canvas.result.current.error).toContain('No se pudo sincronizar');
  await saved.execute(move(180, 'second'));
  unavailable = false;
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await waitFor(() => expect(canvas.result.current.roadmap?.nodes[1].positionX).toBe(180));
  expect(canvas.result.current.error).toBe('No se pudo guardar la posición.');
  await act(async () => {
    await canvas.result.current.canvasCommands.run(move(80));
  });
  expect((await saved.load()).nodes[0].positionX).toBe(80);
  expect(canvas.result.current.error).toBeNull();
});

test.for(['network load', 'server entry'] as const)(
  'leaving a %s canvas discards unsent placements while an already submitted write can commit without changing the next session',
  async (entrySource) => {
    const saved = createInMemoryRoadmapSessionPersistence(roadmap);
    const submitted = deferred();
    const release = deferred();
    let first = true;
    const persistence: RoadmapCanvasSessionPersistence = {
      ...saved,
      async execute(command, previewVersion) {
        if (first) {
          first = false;
          submitted.resolve();
          await release.promise;
        }
        return saved.execute(command, previewVersion);
      },
    };
    const previous = await openCanvas(
      persistence,
      entrySource === 'server entry' ? Promise.resolve(roadmap) : undefined,
    );
    let earlier!: ReturnType<typeof previous.result.current.canvasCommands.run>;
    let later!: typeof earlier;
    act(() => {
      earlier = previous.result.current.canvasCommands.run(move(20));
    });
    await submitted.promise;
    act(() => {
      later = previous.result.current.canvasCommands.run(move(60));
    });
    previous.unmount();
    const next = await openCanvas(saved);
    await act(async () => {
      release.resolve();
      expect(await earlier).toEqual({ applied: false });
      expect(await later).toEqual({ applied: false });
    });
    expect((await saved.load()).nodes[0].positionX).toBe(20);
    expect(next.result.current.roadmap?.nodes[0].positionX).toBe(0);
  },
);

test('a refresh from another teacher preserves newer pending positions over the authoritative Roadmap', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  const submitted = deferred();
  const release = deferred();
  let first = true;
  const canvas = await openCanvas({
    ...saved,
    async execute(command, previewVersion) {
      if (first) {
        first = false;
        submitted.resolve();
        await release.promise;
      }
      return saved.execute(command, previewVersion);
    },
  });
  let earlier!: ReturnType<typeof canvas.result.current.canvasCommands.run>;
  let later!: typeof earlier;
  act(() => {
    earlier = canvas.result.current.canvasCommands.run(move(20));
  });
  await submitted.promise;
  act(() => {
    later = canvas.result.current.canvasCommands.run(move(40));
  });
  await saved.execute({
    kind: 'update-node',
    nodeId: 'second',
    value: { title: 'Derivadas actuales', description: '', nodeTypeId: 'content' },
  });
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await waitFor(() =>
    expect(canvas.result.current.roadmap?.nodes[1].title).toBe('Derivadas actuales'),
  );
  expect(canvas.result.current.roadmap?.nodes[0].positionX).toBe(40);
  await act(async () => {
    release.resolve();
    await Promise.all([earlier, later]);
  });
  expect((await saved.load()).nodes[0].positionX).toBe(40);
});

test('a queued creation waits for its result and attaches staged Resources after it succeeds', async () => {
  const saved = createInMemoryRoadmapSessionPersistence(roadmap);
  const submitted = deferred();
  const release = deferred();
  let first = true;
  const canvas = await openCanvas({
    ...saved,
    async execute(command, previewVersion) {
      if (first) {
        first = false;
        submitted.resolve();
        await release.promise;
      }
      return saved.execute(command, previewVersion);
    },
  });
  const creation = {
    kind: 'add-node' as const,
    nodeId: '9501d69f-e9a2-40c0-b93d-cde6c82f237a',
    node: { title: 'Series', description: '', nodeTypeId: 'content', isVisible: true },
    position: { x: 400, y: 0 },
    displaced: [],
  };
  let movement!: ReturnType<typeof canvas.result.current.canvasCommands.run>;
  let outcome!: ReturnType<typeof createNodeWithResources>;
  act(() => {
    movement = canvas.result.current.canvasCommands.run(move(20));
  });
  await submitted.promise;
  act(() => {
    outcome = createNodeWithResources(canvas.result.current.canvasCommands.run, creation, [
      { id: 'video', type: 'LINK', title: 'Clase grabada', url: 'https://video.example/clase' },
    ]);
  });
  expect((await saved.load()).nodes).toHaveLength(2);
  await act(async () => {
    release.resolve();
    await movement;
    await outcome;
  });
  const created = (await saved.load()).nodes.find(({ title }) => title === 'Series');
  expect(await outcome).toEqual({ nodeId: created?.id, failed: [] });
  expect(created && 'resources' in created ? created.resources : undefined).toEqual([
    expect.objectContaining({ title: 'Clase grabada', type: 'LINK' }),
  ]);
});
