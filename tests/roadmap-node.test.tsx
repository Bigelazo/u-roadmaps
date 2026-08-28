import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { RoadmapNode, type RoadmapFlowNode } from '../src/features/roadmap/graph/RoadmapNode';

function mountEditingNode(onToggleVisibility = vi.fn()) {
  const props = {
    id: 'node-1',
    type: 'roadmap',
    data: {
      title: 'Introducción a funciones',
      typeColor: '#024AD8',
      status: 'editing',
      isHidden: false,
      onToggleVisibility,
    },
    selected: false,
    selectable: true,
    draggable: true,
    dragging: false,
    deletable: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
  } as NodeProps<RoadmapFlowNode>;

  render(
    <ReactFlowProvider>
      <RoadmapNode {...props} />
    </ReactFlowProvider>,
  );
  return onToggleVisibility;
}

test('the editing visibility control triggers the node visibility action', async () => {
  const user = userEvent.setup();
  const onToggleVisibility = mountEditingNode();

  await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
  expect(onToggleVisibility).toHaveBeenCalledOnce();
});

test('the editing visibility control uses a pointer cursor', () => {
  mountEditingNode();

  expect(screen.getByRole('button', { name: 'Ocultar para estudiantes' }).className).toContain(
    'cursor-pointer',
  );
});
