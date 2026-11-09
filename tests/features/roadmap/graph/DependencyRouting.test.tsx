import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  DependencyRouting,
  useDependencyRoute,
  useConnectionPreviewRoute,
  useRoutingEngineStatus,
} from '@/features/roadmap/graph/routing/DependencyRouting';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import { mockViewport } from '../../../support/viewport';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  prepare: vi.fn(),
  route: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock('@/features/roadmap/graph/routing/libavoid', async (original) => {
  const actual = await original<typeof import('@/features/roadmap/graph/routing/libavoid')>();
  return {
    ...actual,
    loadRoutingModule: mocks.load,
    prepareRoutingEngine: mocks.prepare,
    DependencyRouter: class {
      disposed = false;
      route(scene: unknown) {
        if (this.disposed) throw new Error('Disposed scene reused');
        return mocks.route(scene, this);
      }
      dispose() {
        this.disposed = true;
        mocks.dispose();
      }
    },
  };
});

function Edge() {
  return <output data-testid="route">{useDependencyRoute('ab')?.path ?? 'unrouted'}</output>;
}
const nodes: RoadmapFlowNode[] = [
  {
    id: 'a',
    type: 'roadmap',
    position: { x: 0, y: 0 },
    data: {
      title: 'A',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'editing',
      isHidden: false,
      isTeacherBlocked: false,
    },
  },
];
const edges: RoadmapFlowEdge[] = [{ id: 'ab', source: 'a', target: 'a' }];

beforeEach(() => {
  mockViewport(1280);
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({});
  mocks.route.mockImplementation((scene: { obstacles: { x: number }[] }) => ({
    routes: new Map([
      ['ab', { path: `M${scene.obstacles[0]?.x ?? 0},0L100,0`, points: [], label: { x: 0, y: 0 } }],
    ]),
    fallbacks: 0,
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

const preparing = () => screen.queryByText('Preparando dependencias…');
const failure = () => screen.queryByRole('alert');
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const canvas = () => (
  <DependencyRouting nodes={nodes} edges={edges}>
    <Edge />
  </DependencyRouting>
);

test('renders the canvas while the engine loads, survives Strict Mode cleanup and reroutes a moved obstacle but not selection', async () => {
  const view = (current: RoadmapFlowNode[]) => (
    <StrictMode>
      <DependencyRouting nodes={current} edges={edges}>
        <Edge />
      </DependencyRouting>
    </StrictMode>
  );
  const { rerender, unmount } = render(view(nodes));
  expect(screen.getByTestId('route').textContent).toBe('unrouted');
  await waitFor(() => expect(screen.getByTestId('route').textContent).toBe('M0,0L100,0'));
  const calls = mocks.route.mock.calls.length;
  rerender(view([{ ...nodes[0], selected: true }]));
  expect(mocks.route).toHaveBeenCalledTimes(calls);
  rerender(view([{ ...nodes[0], position: { x: 200, y: 0 } }]));
  expect(screen.getByTestId('route').textContent).toBe('M200,0L100,0');
  unmount();
  expect(mocks.dispose).toHaveBeenCalled();
});

test('starts preparing the engine during the first render, before any effect', () => {
  const { rerender } = render(canvas());
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
  expect(mocks.prepare.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.load.mock.invocationCallOrder[0],
  );
  rerender(canvas());
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
});

test('announces the engine only when it misses the status budget', async () => {
  vi.useFakeTimers();
  let finish!: (module: object) => void;
  mocks.load.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(canvas());
  await advance(399);
  expect(preparing()).toBeNull();
  await advance(1);
  expect(screen.getAllByRole('status').map((status) => status.textContent)).toContain(
    'Preparando dependencias…',
  );
  await act(async () => finish({}));
  expect(preparing()).toBeNull();
  expect(screen.getByTestId('route').textContent).toBe('M0,0L100,0');
});

test('a load inside the budget never announces anything', async () => {
  vi.useFakeTimers();
  render(canvas());
  await advance(0);
  expect(screen.getByTestId('route').textContent).toBe('M0,0L100,0');
  await advance(5000);
  expect(preparing()).toBeNull();
});

test('retries a failed load once on its own without surfacing the failure', async () => {
  vi.useFakeTimers();
  mocks.load.mockRejectedValueOnce(new Error('offline'));
  render(canvas());
  await advance(0);
  expect(mocks.load).toHaveBeenCalledTimes(1);
  expect(failure()).toBeNull();
  await advance(1000);
  expect(mocks.load).toHaveBeenCalledTimes(2);
  expect(failure()).toBeNull();
  expect(preparing()).toBeNull();
  expect(screen.getByTestId('route').textContent).toBe('M0,0L100,0');
});

test('offers retry once the automatic retry fails too, then recovers from that button', async () => {
  vi.useFakeTimers();
  mocks.load
    .mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce(new Error('offline'));
  render(canvas());
  await advance(1000);
  expect(mocks.load).toHaveBeenCalledTimes(2);
  expect(failure()?.textContent).toContain('No pudimos trazar las dependencias.');
  expect(preparing()).toBeNull();
  expect(screen.getByTestId('route').textContent).toBe('unrouted');
  await advance(5000);
  expect(mocks.load).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await advance(0);
  expect(mocks.load).toHaveBeenCalledTimes(3);
  expect(failure()).toBeNull();
  expect(screen.getByTestId('route').textContent).toBe('M0,0L100,0');
});

test('a manual retry that fails returns to the alert without another automatic attempt', async () => {
  vi.useFakeTimers();
  mocks.load.mockRejectedValue(new Error('offline'));
  render(canvas());
  await advance(1000);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await advance(5000);
  expect(mocks.load).toHaveBeenCalledTimes(3);
  expect(failure()).not.toBeNull();
});

test('ignores completion and pending retries after unmount', async () => {
  vi.useFakeTimers();
  mocks.load.mockRejectedValueOnce(new Error('offline'));
  const { unmount } = render(canvas());
  await advance(0);
  unmount();
  await advance(5000);
  expect(mocks.load).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
  let finish!: (module: object) => void;
  mocks.load.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { unmount: unmountPending } = render(canvas());
  unmountPending();
  const calls = mocks.route.mock.calls.length;
  await act(async () => {
    finish({});
  });
  expect(mocks.route).toHaveBeenCalledTimes(calls);
});

test('draws a dependency that cannot avoid overlapping nodes without warning about it', async () => {
  mocks.route.mockReturnValue({
    routes: new Map([['ab', { path: 'M0,0L60,0L60,40', points: [], label: { x: 0, y: 0 } }]]),
    fallbacks: 1,
  });
  render(
    <DependencyRouting nodes={nodes} edges={edges}>
      <Edge />
    </DependencyRouting>,
  );
  await waitFor(() => expect(screen.getByTestId('route').textContent).toBe('M0,0L60,0L60,40'));
  expect(screen.queryByText(/sin espacio para trazarse|Separa los nodos/)).toBeNull();
  expect(screen.queryByText(/No pudimos trazar/)).toBeNull();
});

function Preview({ target, pointer }: { target: string; pointer: number }) {
  const path = useConnectionPreviewRoute('a', target);
  return (
    <output data-testid="preview" data-pointer={pointer}>
      {path ?? 'unrouted'}
    </output>
  );
}

test('speculates in a separate router only when target or routing scene changes', async () => {
  mocks.route.mockImplementation((scene: { dependencies: { id: string; target: string }[] }) => ({
    routes: new Map(scene.dependencies.map(({ id, target }) => [id, { path: target }])),
    fallbacks: 0,
  }));
  const view = (target: string, pointer: number, currentNodes = nodes) => (
    <DependencyRouting nodes={currentNodes} edges={edges}>
      <Edge />
      <Preview target={target} pointer={pointer} />
    </DependencyRouting>
  );
  const { rerender } = render(view('b', 1));
  await waitFor(() => expect(screen.getByTestId('preview').textContent).toBe('b'));
  const savedCalls = () =>
    mocks.route.mock.calls.filter(([scene]) => scene.dependencies.length === 1);
  const previewCalls = () =>
    mocks.route.mock.calls.filter(([scene]) => scene.dependencies.length === 2);
  expect(savedCalls()).toHaveLength(1);
  expect(previewCalls()).toHaveLength(1);
  expect(previewCalls()[0][1]).not.toBe(savedCalls()[0][1]);
  expect(previewCalls()[0][1].disposed).toBe(true);
  expect(savedCalls()[0][1].disposed).toBe(false);

  rerender(view('b', 2, [{ ...nodes[0], selected: true }]));
  expect(previewCalls()).toHaveLength(1);
  expect(savedCalls()).toHaveLength(1);
  rerender(view('c', 3));
  expect(screen.getByTestId('preview').textContent).toBe('c');
  expect(previewCalls()).toHaveLength(2);
  expect(savedCalls()).toHaveLength(1);
  rerender(view('c', 4, [{ ...nodes[0], position: { x: 10, y: 0 } }]));
  expect(previewCalls()).toHaveLength(3);
  expect(savedCalls()).toHaveLength(2);
});

function EngineStatus() {
  return <output data-testid="engine">{useRoutingEngineStatus()}</output>;
}
const engineCanvas = () => (
  <DependencyRouting nodes={nodes} edges={edges}>
    <EngineStatus />
  </DependencyRouting>
);
const engine = () => screen.getByTestId('engine').textContent;

test('lets the entry sequence wait for a fast engine and start once it is routed', async () => {
  vi.useFakeTimers();
  let finish!: (module: object) => void;
  mocks.load.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(engineCanvas());
  await advance(399);
  expect(engine()).toBe('waiting');
  await act(async () => finish({}));
  expect(engine()).toBe('routed');
  await advance(5000);
  expect(engine()).toBe('routed');
});

test('gives up on the entry sequence when the engine is slow, until it arrives', async () => {
  vi.useFakeTimers();
  let finish!: (module: object) => void;
  mocks.load.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(engineCanvas());
  await advance(400);
  expect(engine()).toBe('unavailable');
  await act(async () => finish({}));
  expect(engine()).toBe('routed');
});

test('reports the engine unavailable when the load fails before the status budget', async () => {
  vi.useFakeTimers();
  mocks.load.mockRejectedValue(new Error('offline'));
  render(engineCanvas());
  await advance(399);
  expect(engine()).toBe('waiting');
  await advance(1000);
  expect(engine()).toBe('unavailable');
});
