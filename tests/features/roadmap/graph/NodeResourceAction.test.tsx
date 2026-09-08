import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import { expect, test, vi } from 'vitest';
import { RoadmapNode, type RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';

test('keeps Add resource at 60° for hidden nodes and delegates to the selected node', async () => {
  const user = userEvent.setup();
  const onRequestAddResource = vi.fn();
  const props = {
    id: 'hidden-node',
    type: 'roadmap',
    data: {
      title: 'Material docente',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'editing' as const,
      isHidden: true,
      isTeacherBlocked: false,
      canManageActions: true,
      isActionMenuOpen: true,
      onRequestAddResource,
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

  expect(screen.queryByRole('button', { name: 'Bloquear rama' })).toBeNull();
  const action = screen.getByRole('button', { name: 'Agregar recurso' });
  expect(action.getAttribute('data-angle')).toBe('60');
  await user.click(action);
  expect(onRequestAddResource).toHaveBeenCalledWith('hidden-node');
});
