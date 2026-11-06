import { StrictMode, createRef } from 'react';
import { motion } from 'motion/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import {
  AnimatedDependencyPath,
  DependencyAnimationProvider,
  DependencyAnimationReady,
  useNodeEntryProgress,
  type DependencyAnimationControls,
} from '@/features/roadmap/graph/DependencyAnimation';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';

const readiness = vi.hoisted(() => ({ ready: false }));
vi.mock('@xyflow/react', () => ({ useNodesInitialized: () => readiness.ready }));

const edge: RoadmapFlowEdge = { id: 'a-b', source: 'a', target: 'b', type: 'dependency' };

function EntryNode({ id }: { id: string }) {
  const scale = useNodeEntryProgress(id);
  return <motion.div data-testid={`node-${id}`} style={{ scale }} />;
}

function Fixture({
  edges,
  controlsRef,
}: {
  edges: RoadmapFlowEdge[];
  controlsRef: ReturnType<typeof createRef<DependencyAnimationControls>>;
}) {
  return (
    <StrictMode>
      <DependencyAnimationProvider edges={edges} nodeIds={['a', 'b']} controlsRef={controlsRef}>
        <DependencyAnimationReady />
        <EntryNode id="a" />
        <EntryNode id="b" />
        {edges.some((dependency) => dependency.target === 'c') ? <EntryNode id="c" /> : null}
        <svg>
          {edges.map((dependency) => (
            <AnimatedDependencyPath key={dependency.id} id={dependency.id} path="M 0 0 L 100 0" />
          ))}
        </svg>
      </DependencyAnimationProvider>
    </StrictMode>
  );
}

it('waits for geometry, survives StrictMode cleanup, and preserves completed progress through refreshes', async () => {
  const length = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getTotalLength');
  const point = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getPointAtLength');
  Object.defineProperties(SVGElement.prototype, {
    getTotalLength: { configurable: true, value: () => 100 },
    getPointAtLength: { configurable: true, value: (distance: number) => ({ x: distance, y: 0 }) },
  });
  readiness.ready = false;
  const controlsRef = createRef<DependencyAnimationControls>();
  const view = render(<Fixture edges={[edge]} controlsRef={controlsRef} />);
  // eslint-disable-next-line testing-library/no-node-access
  const stroke = () => document.getElementById('a-b')!;
  try {
    expect(stroke().getAttribute('stroke-dasharray')).toBe('0 1');
    expect(screen.getByTestId('node-a').style.transform).toBe('scale(0)');
    expect(screen.getByTestId('node-b').style.transform).toBe('scale(0)');
    readiness.ready = true;
    view.rerender(<Fixture edges={[edge]} controlsRef={controlsRef} />);
    await waitFor(() => expect(screen.getByTestId('node-a').style.transform).not.toBe('scale(0)'));
    expect(stroke().getAttribute('stroke-dasharray')).not.toBe('1 1');
    expect(screen.getByTestId('node-b').style.transform).toBe('scale(0)');
    await waitFor(() => expect(stroke().getAttribute('stroke-dasharray')).toBe('1 1'));
    await waitFor(() => expect(screen.getByTestId('node-b').style.transform).toBe('none'));

    view.rerender(<Fixture edges={[{ ...edge, selected: true }]} controlsRef={controlsRef} />);
    expect(stroke().getAttribute('stroke-dasharray')).toBe('1 1');

    const added: RoadmapFlowEdge = { id: 'b-c', source: 'b', target: 'c', type: 'dependency' };
    view.rerender(<Fixture edges={[edge, added]} controlsRef={controlsRef} />);
    // eslint-disable-next-line testing-library/no-node-access -- Inspect the new SVG path's drawing progress.
    const newStroke = document.getElementById('b-c')!;
    expect(newStroke.getAttribute('stroke-dasharray')).toBe('0 1');
    expect(screen.getByTestId('node-c').style.transform).toBe('scale(0)');
    await waitFor(() => expect(screen.getByTestId('node-c').style.transform).not.toBe('scale(0)'));
    expect(stroke().getAttribute('stroke-dasharray')).toBe('1 1');
    act(() => controlsRef.current?.finish());
    expect(newStroke.getAttribute('stroke-dasharray')).toBe('1 1');
    view.unmount();
    expect(controlsRef.current).toBeNull();
  } finally {
    view.unmount();
    for (const [key, descriptor] of [
      ['getTotalLength', length],
      ['getPointAtLength', point],
    ] as const) {
      if (descriptor) Object.defineProperty(SVGElement.prototype, key, descriptor);
      else Reflect.deleteProperty(SVGElement.prototype, key);
    }
  }
});

it('expands isolated Nodes when an edgeless Roadmap becomes ready', async () => {
  readiness.ready = false;
  const controlsRef = createRef<DependencyAnimationControls>();
  const view = render(<Fixture edges={[]} controlsRef={controlsRef} />);
  expect(screen.getByTestId('node-a').style.transform).toBe('scale(0)');
  readiness.ready = true;
  view.rerender(<Fixture edges={[]} controlsRef={controlsRef} />);
  await waitFor(() => expect(screen.getByTestId('node-a').style.transform).toBe('none'));
  await waitFor(() => expect(screen.getByTestId('node-b').style.transform).toBe('none'));
});
