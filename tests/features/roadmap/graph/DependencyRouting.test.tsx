import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  DependencyRouting,
  useDependencyRoute,
  useConnectionPreviewRoute,
} from '@/features/roadmap/graph/routing/DependencyRouting';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';

const mocks = vi.hoisted(() => ({ load: vi.fn(), route: vi.fn(), dispose: vi.fn() }));
vi.mock('@/features/roadmap/graph/routing/libavoid', async (original) => {
  const actual = await original<typeof import('@/features/roadmap/graph/routing/libavoid')>();
  return {
    ...actual,
    loadRoutingModule: mocks.load,
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
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({});
  mocks.route.mockImplementation((scene: { obstacles: { x: number }[] }) => ({
    routes: new Map([
      ['ab', { path: `M${scene.obstacles[0]?.x ?? 0},0L100,0`, points: [], label: { x: 0, y: 0 } }],
    ]),
    blocked: 0,
  }));
});

test('waits for the engine, survives Strict Mode cleanup and reroutes a moved obstacle but not selection', async () => {
  const view = (current: RoadmapFlowNode[]) => (
    <StrictMode>
      <DependencyRouting nodes={current} edges={edges}>
        <Edge />
      </DependencyRouting>
    </StrictMode>
  );
  const { rerender, unmount } = render(view(nodes));
  expect(screen.getByRole('status').textContent).toBe('Preparando mapa…');
  await waitFor(() => expect(screen.getByTestId('route').textContent).toBe('M0,0L100,0'));
  const calls = mocks.route.mock.calls.length;
  rerender(view([{ ...nodes[0], selected: true }]));
  expect(mocks.route).toHaveBeenCalledTimes(calls);
  rerender(view([{ ...nodes[0], position: { x: 200, y: 0 } }]));
  expect(screen.getByTestId('route').textContent).toBe('M200,0L100,0');
  unmount();
  expect(mocks.dispose).toHaveBeenCalled();
});

test('offers retry after a failed engine load and ignores completion after unmount', async () => {
  mocks.load.mockRejectedValueOnce(new Error('offline'));
  const { unmount } = render(
    <DependencyRouting nodes={nodes} edges={edges}>
      <Edge />
    </DependencyRouting>,
  );
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByTestId('route');
  unmount();
  let finish!: (module: object) => void;
  mocks.load.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { unmount: unmountPending } = render(
    <DependencyRouting nodes={nodes} edges={edges}>
      <Edge />
    </DependencyRouting>,
  );
  unmountPending();
  const calls = mocks.route.mock.calls.length;
  await act(async () => {
    finish({});
  });
  expect(mocks.route).toHaveBeenCalledTimes(calls);
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
    blocked: 0,
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
