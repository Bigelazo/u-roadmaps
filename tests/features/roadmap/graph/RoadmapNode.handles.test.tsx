import { ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mockViewport } from '../../../support/viewport';
import { RoadmapNode, type RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';

class ResizeObserverMeasuringOnObserve {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ target, contentRect: new DOMRect(0, 0, 200, 80) } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}

class IdentityMatrix {
  m22 = 1;
}

beforeEach(() => {
  mockViewport(1280);
  vi.stubGlobal('ResizeObserver', ResizeObserverMeasuringOnObserve);
  vi.stubGlobal('DOMMatrixReadOnly', IdentityMatrix);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(80);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const nodeTypes = { roadmap: RoadmapNode };

function teachingNode(id: string, x: number, isHidden: boolean): RoadmapFlowNode {
  return {
    id,
    type: 'roadmap',
    position: { x, y: 0 },
    measured: { width: 200, height: 80 },
    data: {
      title: id,
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'editing',
      isTeacherBlocked: false,
      isHidden,
      canManageActions: true,
    },
  };
}

function MeasuredHandleIds({ nodeId }: { nodeId: string }) {
  const { getInternalNode } = useReactFlow();
  const [handleIds, setHandleIds] = useState('');
  return (
    <button
      type="button"
      onClick={() =>
        setHandleIds(
          (getInternalNode(nodeId)?.internals.handleBounds?.source ?? [])
            .map((handle) => handle.id)
            .join(','),
        )
      }
    >
      {`Puntos medidos: ${handleIds}`}
    </button>
  );
}

function TeachingGraph({ targetHidden }: { targetHidden: boolean }) {
  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={[teachingNode('source', 0, false), teachingNode('target', 400, targetHidden)]}
        edges={[]}
        nodeTypes={nodeTypes}
      >
        <MeasuredHandleIds nodeId="target" />
      </ReactFlow>
    </ReactFlowProvider>
  );
}

test('a Node shown again after being hidden keeps measured handles for its Dependencies', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<TeachingGraph targetHidden />);
  rerender(<TeachingGraph targetHidden={false} />);

  await user.click(screen.getByRole('button', { name: /Puntos medidos/ }));

  expect(screen.getByRole('button', { name: /Puntos medidos/ }).textContent).toBe(
    'Puntos medidos: top,right,bottom,left',
  );
});
