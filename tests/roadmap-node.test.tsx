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
      typeName: 'Contenido',
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

test('uses the node type as its label instead of repeating its available status', () => {
  const props = {
    id: 'node-2',
    type: 'roadmap',
    data: {
      title: 'Introducción a funciones',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      status: 'available',
      isHidden: false,
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

  expect(screen.getByText('Contenido')).toBeTruthy();
  expect(screen.queryByText('Disponible')).toBeNull();
});

test('labels completed and available status icons for assistive technology', () => {
  const sharedProps = {
    id: 'node-3',
    type: 'roadmap' as const,
    data: {
      title: 'Introducción a funciones',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      isHidden: false,
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
  };
  render(
    <ReactFlowProvider>
      <RoadmapNode
        {...({
          ...sharedProps,
          data: { ...sharedProps.data, status: 'completed' },
        } as NodeProps<RoadmapFlowNode>)}
      />
    </ReactFlowProvider>,
  );
  render(
    <ReactFlowProvider>
      <RoadmapNode
        {...({
          ...sharedProps,
          data: { ...sharedProps.data, status: 'available' },
        } as NodeProps<RoadmapFlowNode>)}
      />
    </ReactFlowProvider>,
  );

  expect(screen.getByRole('img', { name: 'Completado' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Disponible' })).toBeTruthy();
});
