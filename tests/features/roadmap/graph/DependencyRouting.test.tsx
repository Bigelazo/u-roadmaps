import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  DependencyRouting,
  useDependencyRoute,
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
        return mocks.route(scene);
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
    blocked: 0,
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

test('the reveal class lasts until the first dependency has faded in', async () => {
  const { container } = render(
    <DependencyRouting nodes={nodes} edges={edges}>
      <Edge />
      <svg>
        <path className="react-flow__edge-path" data-testid="edge-path" />
      </svg>
      <div data-testid="other" />
    </DependencyRouting>,
  );
  await waitFor(() => expect(screen.getByTestId('route').textContent).toBe('M0,0L100,0'));
  // eslint-disable-next-line testing-library/no-node-access -- the class is the only observable.
  const wrapper = container.firstElementChild!;
  const initial = wrapper.className;
  expect(initial).toContain('contents');
  // jsdom has no AnimationEvent, so React listens for the prefixed name it resolves there.
  const animationEnd = (element: Element) =>
    fireEvent(element, new Event('webkitAnimationEnd', { bubbles: true }));
  animationEnd(screen.getByTestId('other'));
  expect(wrapper.className).toBe(initial);
  animationEnd(screen.getByTestId('edge-path'));
  expect(wrapper.className).toBe('contents');
});

test('reports an impossible route without substituting a native crossing path', async () => {
  mocks.route.mockReturnValue({ routes: new Map(), blocked: 1 });
  render(
    <DependencyRouting nodes={nodes} edges={edges}>
      <Edge />
    </DependencyRouting>,
  );
  await screen.findByText(
    'Hay dependencias sin espacio para trazarse. Separa los nodos superpuestos.',
  );
  expect(screen.getByTestId('route').textContent).toBe('unrouted');
});
