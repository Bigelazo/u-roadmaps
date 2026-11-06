import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ConnectionLineType, Position, type ConnectionLineComponentProps } from '@xyflow/react';
import {
  ConnectionPreview,
  ConnectionTargetContext,
  TouchConnectionPreview,
} from '@/features/roadmap/graph/ConnectionPreview';

const { viewport, canvas, previewRoute } = vi.hoisted(() => ({
  previewRoute: { path: 'M 220,140 L 280,140 L 280,70 L 230,70' as string | null },
  viewport: { x: 50, y: -30, zoom: 2 },
  canvas: { x: 300, y: 90 },
}));

vi.mock('@/features/roadmap/graph/routing/DependencyRouting', () => ({
  useConnectionPreviewRoute: () => previewRoute.path,
}));

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useReactFlow: () => ({
    getViewport: () => viewport,
    screenToFlowPosition: (point: { x: number; y: number }) => ({
      x: (point.x - canvas.x - viewport.x) / viewport.zoom,
      y: (point.y - canvas.y - viewport.y) / viewport.zoom,
    }),
  }),
  ViewportPortal: ({ children }: { children: ReactNode }) => <g>{children}</g>,
}));

const source = { x: 100, y: 100, width: 120, height: 80 };
const target = { id: 'target', x: 230, y: -100, width: 260, height: 340 };
const points = [
  { x: 360, y: 140, anchor: [220, 140] },
  { x: 160, y: -60, anchor: [160, 100] },
  { x: -40, y: 140, anchor: [100, 140] },
  { x: 160, y: 340, anchor: [160, 180] },
];

function desktopProps(point: { x: number; y: number }): ConnectionLineComponentProps {
  return {
    connectionLineType: ConnectionLineType.SmoothStep,
    fromNode: {
      id: 'source',
      data: {},
      position: { x: source.x, y: source.y },
      measured: { width: source.width, height: source.height },
      internals: { positionAbsolute: { x: source.x, y: source.y }, z: 0 },
    },
    fromHandle: { id: 'right', position: Position.Right },
    fromX: 238,
    fromY: 140,
    fromPosition: Position.Right,
    toX: point.x,
    toY: point.y,
    toPosition: Position.Left,
    toNode: null,
    toHandle: null,
    connectionStatus: null,
    pointer: { x: point.x * viewport.zoom + viewport.x, y: point.y * viewport.zoom + viewport.y },
  } as ConnectionLineComponentProps;
}

function strokeCoordinates() {
  // SVG geometry has no accessible text; inspect the actual stroke next to its open arrowhead.
  // eslint-disable-next-line testing-library/no-node-access
  const path = screen.getByTestId('dependency-arrowhead').previousElementSibling!;
  const numbers = path
    .getAttribute('d')!
    .match(/-?\d+(?:\.\d+)?/g)!
    .map(Number);
  return { start: numbers.slice(0, 2), end: numbers.slice(-2) };
}

test('a single desktop drag follows the pointer right, top, left and bottom despite a fixed launch side', () => {
  const preview = (point: (typeof points)[number]) => (
    <svg>
      <ConnectionPreview {...desktopProps(point)} />
    </svg>
  );
  const view = render(preview(points[0]));
  for (const point of points) {
    view.rerender(preview(point));
    expect(strokeCoordinates()).toEqual({ start: point.anchor, end: [point.x, point.y] });
  }
});

test('hovering a valid target uses the saved-router path instead of cursor-driven anchors', () => {
  const point = { x: 240, y: -90 };
  render(
    <svg>
      <ConnectionTargetContext value={target}>
        <ConnectionPreview {...desktopProps(point)} />
      </ConnectionTargetContext>
    </svg>,
  );
  // The native route's source anchor wins over the pointer-driven top anchor.
  expect(strokeCoordinates()).toEqual({ start: [220, 140], end: [230, 70] });
});

test('touch preview uses the same pointer-driven source sides after screen-to-flow conversion', () => {
  const preview = (point: (typeof points)[number]) => (
    <svg>
      <TouchConnectionPreview
        source={source}
        sourceId="source"
        target={null}
        pointer={{
          x: point.x * viewport.zoom + viewport.x + canvas.x,
          y: point.y * viewport.zoom + viewport.y + canvas.y,
        }}
      />
    </svg>
  );
  const view = render(preview(points[0]));
  for (const point of points) {
    view.rerender(preview(point));
    expect(strokeCoordinates()).toEqual({ start: point.anchor, end: [point.x, point.y] });
  }
});

test('touch target snapping uses the same saved-router path as desktop', () => {
  const point = { x: 240, y: -90 };
  render(
    <svg>
      <TouchConnectionPreview
        source={source}
        sourceId="source"
        target={target}
        targetId="target"
        pointer={{
          x: point.x * viewport.zoom + viewport.x + canvas.x,
          y: point.y * viewport.zoom + viewport.y + canvas.y,
        }}
      />
    </svg>,
  );
  expect(strokeCoordinates()).toEqual({ start: [220, 140], end: [230, 70] });
});

test('an unmeasured source retains the provided launch coordinates as its fallback', () => {
  const props = desktopProps(points[2]);
  props.fromNode = { ...props.fromNode, measured: {} };
  render(
    <svg>
      <ConnectionPreview {...props} />
    </svg>,
  );
  expect(strokeCoordinates().start).toEqual([238, 140]);
});

test('a blocked valid target does not display an unsafe smooth-step fallback', () => {
  previewRoute.path = null;
  try {
    render(
      <svg>
        <ConnectionTargetContext value={target}>
          <ConnectionPreview {...desktopProps({ x: 240, y: -90 })} />
        </ConnectionTargetContext>
      </svg>,
    );
    expect(screen.queryByTestId('dependency-arrowhead')).toBeNull();
  } finally {
    previewRoute.path = 'M 220,140 L 280,140 L 280,70 L 230,70';
  }
});
