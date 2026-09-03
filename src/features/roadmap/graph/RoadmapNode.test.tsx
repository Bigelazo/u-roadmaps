import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { RoadmapNode, type RoadmapFlowNode } from './RoadmapNode';
import { roadmapNodeSizeForTitle } from './geometry';
import type { StudentNodeBlockReason } from '../types';

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
            status: 'locked',
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
      status: 'editing',
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
});

test('keeps dependency handles mounted, but inert, for student nodes', () => {
  const props = {
    id: 'student-node',
    type: 'roadmap',
    data: {
      title: 'Funciones',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      status: 'available',
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

test.each([
  ['TEACHER_BLOCK', 'Bloqueado por el equipo docente'],
  ['PREREQUISITE_BLOCK', 'Completa los prerrequisitos'],
] as const)('shows the %s block reason without hiding node identity', (reason, message) => {
  mountBlockedNode(reason);

  expect(screen.getByText('Contenido bloqueado')).toBeTruthy();
  expect(screen.getByText('Contenido')).toBeTruthy();
  expect(screen.getByText(message)).toBeTruthy();
  expect(screen.getByRole('img', { name: message })).toBeTruthy();
  const card = screen.getByTestId('roadmap-card');
  expect(card.className).toContain('cursor-not-allowed');
  expect(card.getAttribute('aria-disabled')).toBe('true');
  expect(screen.queryByRole('button')).toBeNull();
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
          status: 'available',
          isHidden: false,
        })}
      />
      <RoadmapNode
        {...nodeProps({
          title: 'Un título deliberadamente muy largo que ocuparía más de dos líneas sin recortarse',
          typeColor: '#024AD8',
          typeName: 'Contenido',
          status: 'available',
          isHidden: false,
        })}
      />
      <RoadmapNode
        {...nodeProps({
          title: 'Oculto',
          typeColor: '#024AD8',
          typeName: 'Contenido',
          status: 'editing',
          isHidden: true,
        })}
      />
      <RoadmapNode
        {...nodeProps({
          title: 'Bloqueado',
          typeColor: '#024AD8',
          typeName: 'Contenido',
          status: 'locked',
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

test('wraps long card titles while preserving their full accessible name', () => {
  const title = 'Un título deliberadamente muy largo que ocuparía más de dos líneas sin recortarse';
  const props = {
    id: 'long-title',
    type: 'roadmap',
    data: {
      title,
      typeColor: '#024AD8',
      typeName: 'Contenido',
      status: 'available',
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
  expect(heading.getAttribute('title')).toBe(title);
  expect(heading.className).toContain('break-words');
});
