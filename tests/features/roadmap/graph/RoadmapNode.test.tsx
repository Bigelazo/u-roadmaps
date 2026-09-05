import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { RoadmapNode, type RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import { roadmapNodeSizeForTitle } from '@/features/roadmap/graph/geometry';
import type { StudentNodeBlockReason } from '@/features/roadmap/types';

afterEach(() => {
  vi.useRealTimers();
});

function mountBlockedNode(blockReason: StudentNodeBlockReason) {
  render(
    <ReactFlowProvider>
      <RoadmapNode
        {...({
          id: `node-${blockReason}`,
          type: 'roadmap',
          data: {
            title: 'Contenido bloqueado',
            typeColor: '#024AD8',
            typeName: 'Contenido',
            typeIcon: 'BookOpen',
            status: 'locked',
            isTeacherBlocked: false,
            blockReason,
            isHidden: false,
          },
          selected: false,
          selectable: false,
          draggable: false,
          dragging: false,
          deletable: false,
          isConnectable: false,
          positionAbsoluteX: 0,
          positionAbsoluteY: 0,
          zIndex: 0,
        } as NodeProps<RoadmapFlowNode>)}
      />
    </ReactFlowProvider>,
  );
}

test('marks hidden teacher nodes with a distinct visual treatment and no visibility action', () => {
  const props = {
    id: 'hidden-node',
    type: 'roadmap',
    data: {
      title: 'Material de coordinación',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'editing',
      isTeacherBlocked: false,
      isHidden: true,
    },
    selected: false,
    selectable: true,
    draggable: true,
    dragging: false,
    deletable: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
  } as NodeProps<RoadmapFlowNode>;

  render(
    <ReactFlowProvider>
      <RoadmapNode {...props} />
    </ReactFlowProvider>,
  );

  expect(screen.queryAllByTestId('roadmap-node-handle')).toHaveLength(0);
  expect(screen.queryByText('Oculto para estudiantes')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  const card = screen.getByTestId('roadmap-card');
  expect(card.getAttribute('aria-label')).toBe('Material de coordinación: oculto para estudiantes');
  expect(card.dataset.hidden).toBe('true');
  expect(card.className).toContain('border-dashed');
  expect(card.style.backgroundImage).toContain('repeating-linear-gradient');
  const hiddenBadge = screen.getByRole('img', { name: 'Oculto para estudiantes' });
  expect(hiddenBadge).toBeTruthy();
});

test('keeps dependency handles mounted, but inert, for student nodes', () => {
  const props = {
    id: 'student-node',
    type: 'roadmap',
    data: {
      title: 'Funciones',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'available',
      isTeacherBlocked: false,
      isHidden: false,
    },
    selected: false,
    selectable: true,
    draggable: false,
    dragging: false,
    deletable: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
  } as NodeProps<RoadmapFlowNode>;

  render(
    <ReactFlowProvider>
      <RoadmapNode {...props} />
    </ReactFlowProvider>,
  );

  expect(screen.getAllByTestId('roadmap-node-handle')).toHaveLength(4);
  for (const handle of screen.getAllByTestId('roadmap-node-handle')) {
    expect(handle.style.visibility).toBe('hidden');
    expect(handle.style.pointerEvents).toBe('none');
  }
});

test('shows the node-type icon with an accessible label, rather than persistent status text', () => {
  const props = {
    id: 'node-2',
    type: 'roadmap',
    data: {
      title: 'Introducción a funciones',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'available',
      isTeacherBlocked: false,
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

  expect(screen.getByRole('img', { name: 'Contenido' })).toBeTruthy();
  expect(screen.queryByText('Pendiente')).toBeNull();
});

test('summarizes files and web resources separately with accessible icons', () => {
  const props = {
    id: 'node-resources',
    type: 'roadmap',
    data: {
      title: 'Material de estudio',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'available' as const,
      isTeacherBlocked: false,
      isHidden: false,
      fileCount: 2,
      linkCount: 3,
    },
    selected: false,
    selectable: true,
    draggable: false,
    dragging: false,
    deletable: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
  } as NodeProps<RoadmapFlowNode>;

  render(
    <ReactFlowProvider>
      <RoadmapNode {...props} />
    </ReactFlowProvider>,
  );

  expect(screen.getByTestId('roadmap-node-resources')).toBeTruthy();
  expect(screen.getByRole('img', { name: '2 archivos' })).toBeTruthy();
  expect(screen.getByRole('img', { name: '3 enlaces' })).toBeTruthy();
});

test('does not reserve a resource summary when the node has no resources', () => {
  const props = {
    id: 'node-without-resources',
    type: 'roadmap',
    data: {
      title: 'Material de estudio',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'available' as const,
      isTeacherBlocked: false,
      isHidden: false,
    },
    selected: false,
    selectable: true,
    draggable: false,
    dragging: false,
    deletable: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
  } as NodeProps<RoadmapFlowNode>;

  render(
    <ReactFlowProvider>
      <RoadmapNode {...props} />
    </ReactFlowProvider>,
  );

  expect(screen.queryByTestId('roadmap-node-resources')).toBeNull();
});

test('does not lift a roadmap node on hover', () => {
  const props = {
    id: 'node-without-hover-lift',
    type: 'roadmap',
    data: {
      title: 'Introducción a funciones',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'available' as const,
      isTeacherBlocked: false,
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

  const card = screen.getByTestId('roadmap-card');
  expect(card.className).not.toContain('hover:translate-y');
  expect(card.className).not.toContain('transition-[transform');
});

test('labels completed and pending status badges for assistive technology', () => {
  const sharedProps = {
    id: 'node-3',
    type: 'roadmap' as const,
    data: {
      title: 'Introducción a funciones',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      isHidden: false,
      isTeacherBlocked: false,
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
  expect(screen.getByRole('img', { name: 'Pendiente' })).toBeTruthy();
});

test('gives the node status badge a visual hover affordance', () => {
  const props = {
    id: 'node-status-hover',
    type: 'roadmap',
    data: {
      title: 'Introducción a funciones',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'available' as const,
      isTeacherBlocked: false,
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

  const statusBadge = screen.getByRole('img', { name: 'Pendiente' });
  expect(statusBadge.className).toContain('hover:scale-110');
  expect(statusBadge.className).toContain('hover:bg-muted');
  expect(statusBadge.className).toContain('hover:shadow-md');
  expect(statusBadge.className).toContain('motion-reduce:transform-none');
});

test('opens node icon and status tooltips immediately, with the status below its badge', async () => {
  vi.useFakeTimers();
  const props = {
    id: 'node-tooltip',
    type: 'roadmap',
    data: {
      title: 'Introducción a funciones',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'available' as const,
      isTeacherBlocked: false,
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

  fireEvent.mouseEnter(screen.getByRole('img', { name: 'Contenido' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(screen.getByText('Contenido').closest('[data-slot="tooltip-content"]')).toBeTruthy();

  fireEvent.mouseLeave(screen.getByRole('img', { name: 'Contenido' }));
  fireEvent.mouseEnter(screen.getByRole('img', { name: 'Pendiente' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  const statusTooltip = screen.getByText('Pendiente').closest('[data-slot="tooltip-content"]');
  expect(statusTooltip).toBeTruthy();
  expect(statusTooltip?.getAttribute('data-side')).toBe('bottom');
});

test.each([
  ['TEACHER_BLOCK', 'Bloqueado por el equipo docente'],
  ['PREREQUISITE_BLOCK', 'Completa los prerrequisitos'],
] as const)('shows the %s block reason without hiding node identity', (reason, message) => {
  mountBlockedNode(reason);

  expect(screen.getByText('Contenido bloqueado')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Contenido' })).toBeTruthy();
  expect(screen.getByText(message)).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Bloqueado' })).toBeTruthy();
  const card = screen.getByTestId('roadmap-card');
  expect(card.className).toContain('cursor-not-allowed');
  expect(card.getAttribute('aria-disabled')).toBe('true');
  expect(screen.queryByRole('button')).toBeNull();
});

test('shows teacher blocks like student blocks without disabling editing', () => {
  const props = {
    id: 'teacher-blocked-node',
    type: 'roadmap',
    data: {
      title: 'Contenido bloqueado por docencia',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'editing',
      isTeacherBlocked: true,
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

  const card = screen.getByTestId('roadmap-card');
  expect(screen.queryByText('Bloqueado por docencia')).toBeNull();
  expect(screen.getByRole('img', { name: 'Bloqueado por docencia' })).toBeTruthy();
  expect(card.style.backgroundColor).toBe('var(--cloud)');
  expect(card.className).toContain('cursor-pointer');
  expect(card.getAttribute('aria-disabled')).toBeNull();
});

test('sizes cards from their titles in grid-aligned dimensions', () => {
  const nodeProps = (data: RoadmapFlowNode['data']) =>
    ({
      id: crypto.randomUUID(),
      type: 'roadmap',
      data,
      selected: false,
      selectable: true,
      draggable: false,
      dragging: false,
      deletable: false,
      isConnectable: false,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      zIndex: 0,
    }) as NodeProps<RoadmapFlowNode>;

  render(
    <ReactFlowProvider>
      <RoadmapNode
        {...nodeProps({
          title: 'Breve',
          typeColor: '#024AD8',
          typeName: 'Contenido',
          typeIcon: 'BookOpen',
          status: 'available',
          isTeacherBlocked: false,
          isHidden: false,
        })}
      />
      <RoadmapNode
        {...nodeProps({
          title:
            'Un título deliberadamente muy largo que ocuparía más de dos líneas sin recortarse',
          typeColor: '#024AD8',
          typeName: 'Contenido',
          typeIcon: 'BookOpen',
          status: 'available',
          isTeacherBlocked: false,
          isHidden: false,
        })}
      />
      <RoadmapNode
        {...nodeProps({
          title: 'Oculto',
          typeColor: '#024AD8',
          typeName: 'Contenido',
          typeIcon: 'BookOpen',
          status: 'editing',
          isTeacherBlocked: false,
          isHidden: true,
        })}
      />
      <RoadmapNode
        {...nodeProps({
          title: 'Bloqueado',
          typeColor: '#024AD8',
          typeName: 'Contenido',
          typeIcon: 'BookOpen',
          status: 'locked',
          isTeacherBlocked: false,
          isHidden: false,
          blockReason: 'PREREQUISITE_BLOCK',
        })}
      />
    </ReactFlowProvider>,
  );

  const cards = screen.getAllByTestId('roadmap-card');
  const titles = [
    'Breve',
    'Un título deliberadamente muy largo que ocuparía más de dos líneas sin recortarse',
    'Oculto',
    'Bloqueado',
  ];
  for (const [index, card] of cards.entries()) {
    const size = roadmapNodeSizeForTitle(titles[index]);
    expect(size.width % 20).toBe(0);
    expect(size.height % 20).toBe(0);
    expect(card.style.width).toBe(`${size.width}px`);
    expect(card.style.height).toBe(`${size.height}px`);
  }
  expect(cards[1].style.height).not.toBe(cards[0].style.height);
});

test('wraps long card titles without truncating them', () => {
  const title = 'Un título deliberadamente muy largo que ocuparía más de dos líneas sin recortarse';
  const props = {
    id: 'long-title',
    type: 'roadmap',
    data: {
      title,
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'available',
      isTeacherBlocked: false,
      isHidden: false,
    },
    selected: false,
    selectable: true,
    draggable: false,
    dragging: false,
    deletable: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
  } as NodeProps<RoadmapFlowNode>;

  render(
    <ReactFlowProvider>
      <RoadmapNode {...props} />
    </ReactFlowProvider>,
  );

  const heading = screen.getByText(title);
  const content = screen.getByTestId('roadmap-node-content');
  expect(content.className).toContain('h-full');
  expect(content.className).toContain('items-center');
  expect(content.className).toContain('justify-center');
  expect(heading.getAttribute('title')).toBe(title);
  expect(heading.className).not.toContain('line-clamp-2');
  expect(heading.className).toContain('wrap-break-word');
  expect(heading.className).toContain('text-left');
});
