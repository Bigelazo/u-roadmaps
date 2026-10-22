import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { RoadmapNode, type RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import { roadmapNodeSizeForTitle } from '@/features/roadmap/graph/geometry';
import type { StudentNodeBlockReason } from '@/features/roadmap/types';
import { NodeChangeCountsProvider } from '@/features/notifications/components/inbox-driver';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type NodePropsOverrides = Partial<Omit<NodeProps<RoadmapFlowNode>, 'data'>> & {
  data?: Partial<RoadmapFlowNode['data']>;
};

function nodeProps({ data, ...props }: NodePropsOverrides = {}) {
  return {
    id: 'node',
    type: 'roadmap',
    selected: false,
    selectable: true,
    draggable: true,
    dragging: false,
    deletable: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    ...props,
    data: {
      title: 'Introducción a funciones',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'available',
      isTeacherBlocked: false,
      isHidden: false,
      ...data,
    },
  } as NodeProps<RoadmapFlowNode>;
}

const studentNodeProps = (overrides: NodePropsOverrides) =>
  nodeProps({ draggable: false, isConnectable: false, ...overrides });

function renderNode(props: NodeProps<RoadmapFlowNode>) {
  const { rerender } = render(
    <ReactFlowProvider>
      <RoadmapNode {...props} />
    </ReactFlowProvider>,
  );
  return {
    rerenderWith: (next: NodeProps<RoadmapFlowNode>) =>
      rerender(
        <ReactFlowProvider>
          <RoadmapNode {...next} />
        </ReactFlowProvider>,
      ),
  };
}

function mountBlockedNode(blockReason: StudentNodeBlockReason) {
  renderNode(
    studentNodeProps({
      id: `node-${blockReason}`,
      selectable: false,
      data: { title: 'Contenido bloqueado', status: 'locked', blockReason },
    }),
  );
}

test('marks hidden teacher nodes with a distinct visual treatment and no visibility action', () => {
  renderNode(
    nodeProps({
      id: 'hidden-node',
      isConnectable: false,
      data: { title: 'Material de coordinación', status: 'editing', isHidden: true },
    }),
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

test('opens the teaching action menu independently and emits contextual Roadmap intents', async () => {
  const user = userEvent.setup();
  const onToggleActionMenu = vi.fn();
  const onAction = vi.fn();
  const menuProps = (isActionMenuOpen: boolean) =>
    nodeProps({
      id: 'teacher-node',
      data: {
        title: 'Límites',
        status: 'editing',
        canManageActions: true,
        isActionMenuOpen,
        onToggleActionMenu,
        onAction,
      },
    });
  const { rerenderWith } = renderNode(menuProps(false));

  await user.click(screen.getByRole('button', { name: 'Abrir menú de acciones del nodo' }));
  expect(onToggleActionMenu).toHaveBeenCalledWith('teacher-node', expect.any(HTMLButtonElement));

  rerenderWith(menuProps(true));
  expect(screen.queryByTestId('node-action-focus')).toBeNull();
  expect(screen.getByRole('group', { name: 'Menú de acciones del nodo' })).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Bloquear nodo' }));
  expect(onAction).toHaveBeenCalledWith({
    kind: 'change-teacher-block',
    nodeId: 'teacher-node',
    operation: 'BLOCK',
  });
  const visibilityAction = screen.getByRole('button', { name: 'Ocultar para estudiantes' });
  expect(visibilityAction.getAttribute('data-slot')).toBe('node-action-visibility');
  expect(screen.getByTestId('node-action-access-default-icon')).toBeTruthy();
  expect(screen.getByTestId('node-action-access-hover-icon')).toBeTruthy();
  expect(screen.getByTestId('node-action-visibility-default-icon')).toBeTruthy();
  expect(screen.getByTestId('node-action-visibility-hover-icon')).toBeTruthy();
  expect(visibilityAction.parentElement?.style.getPropertyValue('--i')).toBe('1');
  expect(visibilityAction.parentElement?.style.getPropertyValue('--total')).toBe('4');
  const resourceAction = screen.getByRole('button', { name: 'Agregar recurso' });
  expect(resourceAction.parentElement?.style.getPropertyValue('--angle')).toBe('60deg');
  await user.click(resourceAction);
  expect(onAction).toHaveBeenCalledWith({ kind: 'add-resource', nodeId: 'teacher-node' });
  const deleteAction = screen.getByRole('button', { name: 'Eliminar nodo' });
  expect(deleteAction.parentElement?.style.getPropertyValue('--angle')).toBe('90deg');
  await user.click(deleteAction);
  expect(onAction).toHaveBeenCalledWith({ kind: 'delete-node', nodeId: 'teacher-node' });
  await user.click(visibilityAction);
  expect(onAction).toHaveBeenCalledWith({ kind: 'hide-node', nodeId: 'teacher-node' });
  expect(screen.getByRole('button', { name: 'Cerrar menú de acciones del nodo' })).toBeTruthy();
});

test('offers showing a hidden node without an access action', async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  const menuProps = (isActionMenuOpen: boolean) =>
    nodeProps({
      id: 'hidden-teacher-node',
      isConnectable: false,
      data: {
        title: 'Material de coordinación',
        status: 'editing',
        isHidden: true,
        canManageActions: true,
        isActionMenuOpen,
        onAction,
      },
    });
  const { rerenderWith } = renderNode(menuProps(false));

  expect(screen.getByTestId('node-action-trigger-hidden')).toBeTruthy();
  expect(screen.queryByTestId('node-action-trigger-close')).toBeNull();

  rerenderWith(menuProps(true));

  expect(screen.getByTestId('node-action-trigger-close')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Bloquear nodo' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Desbloquear' })).toBeNull();
  const visibilityAction = screen.getByRole('button', { name: 'Mostrar para estudiantes' });
  expect(visibilityAction.getAttribute('data-slot')).toBe('node-action-visibility');
  expect(screen.getByTestId('node-action-visibility-default-icon')).toBeTruthy();
  expect(screen.getByTestId('node-action-visibility-hover-icon')).toBeTruthy();
  expect(visibilityAction.parentElement?.style.getPropertyValue('--i')).toBe('0');
  expect(visibilityAction.parentElement?.style.getPropertyValue('--total')).toBe('3');
  expect(
    screen
      .getByRole('button', { name: 'Agregar recurso' })
      .parentElement?.style.getPropertyValue('--angle'),
  ).toBe('60deg');
  await user.click(visibilityAction);
  expect(onAction).toHaveBeenCalledWith({ kind: 'show-node', nodeId: 'hidden-teacher-node' });
  expect(screen.getByRole('button', { name: 'Eliminar nodo' })).toBeTruthy();
});

test('offers the contextual unblock action for a visible teacher-blocked node', async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  renderNode(
    nodeProps({
      id: 'blocked-teacher-node',
      data: {
        title: 'Material bloqueado',
        status: 'editing',
        isTeacherBlocked: true,
        canManageActions: true,
        isActionMenuOpen: true,
        onAction,
      },
    }),
  );

  await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
  expect(onAction).toHaveBeenCalledWith({
    kind: 'change-teacher-block',
    nodeId: 'blocked-teacher-node',
    operation: 'UNBLOCK',
  });
});

test('keeps dependency handles mounted, but inert, for student nodes', () => {
  renderNode(studentNodeProps({ id: 'student-node', data: { title: 'Funciones' } }));

  expect(screen.getAllByTestId('roadmap-node-handle')).toHaveLength(4);
  for (const handle of screen.getAllByTestId('roadmap-node-handle')) {
    expect(handle.style.visibility).toBe('hidden');
    expect(handle.style.pointerEvents).toBe('none');
  }
});

test('shows the node-type icon with an accessible label, rather than persistent status text', () => {
  renderNode(nodeProps({ id: 'node-2' }));

  expect(screen.getByRole('img', { name: 'Contenido' })).toBeTruthy();
  expect(screen.queryByText('Pendiente')).toBeNull();
});

test.each([
  {
    name: 'summarizes files and web resources separately with accessible icons',
    id: 'node-resources',
    resources: { fileCount: 2, linkCount: 3 },
    labels: ['2 archivos', '3 enlaces'],
  },
  {
    name: 'does not reserve a resource summary when the node has no resources',
    id: 'node-without-resources',
    resources: {},
    labels: [],
  },
])('$name', ({ id, resources, labels }) => {
  renderNode(studentNodeProps({ id, data: { title: 'Material de estudio', ...resources } }));

  expect(screen.queryByTestId('roadmap-node-resources') !== null).toBe(labels.length > 0);
  for (const name of labels) expect(screen.getByRole('img', { name })).toBeTruthy();
});

test('does not lift a roadmap node on hover', () => {
  renderNode(nodeProps({ id: 'node-without-hover-lift' }));

  const card = screen.getByTestId('roadmap-card');
  expect(card.className).not.toContain('hover:translate-y');
  expect(card.className).not.toContain('transition-[transform');
});

test('labels completed and pending status badges for assistive technology', () => {
  renderNode(nodeProps({ id: 'node-3', data: { status: 'completed' } }));
  renderNode(nodeProps({ id: 'node-3', data: { status: 'available' } }));

  expect(screen.getByRole('img', { name: 'Completado' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Pendiente' })).toBeTruthy();
});

test('gives the node status badge a visual hover affordance', () => {
  renderNode(nodeProps({ id: 'node-status-hover' }));

  const statusBadge = screen.getByRole('img', { name: 'Pendiente' });
  expect(statusBadge.className).toContain('hover:scale-110');
  expect(statusBadge.className).toContain('hover:bg-muted');
  expect(statusBadge.className).toContain('hover:shadow-md');
  expect(statusBadge.className).toContain('motion-reduce:transform-none');
});

test('opens node icon and status tooltips immediately, with the status below its badge', async () => {
  vi.useFakeTimers();
  renderNode(nodeProps({ id: 'node-tooltip' }));

  fireEvent.mouseEnter(screen.getByRole('img', { name: 'Contenido' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(screen.getByText('Contenido').getAttribute('data-slot')).toBe('tooltip-content');

  fireEvent.mouseLeave(screen.getByRole('img', { name: 'Contenido' }));
  fireEvent.mouseEnter(screen.getByRole('img', { name: 'Pendiente' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  const statusTooltip = screen.getByText('Pendiente');
  expect(statusTooltip.getAttribute('data-slot')).toBe('tooltip-content');
  expect(statusTooltip.getAttribute('data-side')).toBe('bottom');
});

test.each(['TEACHER_BLOCK', 'PREREQUISITE_BLOCK'] as const)(
  'does not show a supplementary message for %s blocks',
  (reason) => {
    mountBlockedNode(reason);

    expect(screen.getByText('Contenido bloqueado')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Contenido' })).toBeTruthy();
    expect(screen.queryByText('Bloqueado por el equipo docente')).toBeNull();
    expect(screen.queryByText('Completa los prerrequisitos')).toBeNull();
    expect(screen.getByRole('img', { name: 'Bloqueado' })).toBeTruthy();
    const card = screen.getByTestId('roadmap-card');
    expect(card.className).toContain('cursor-not-allowed');
    expect(card.getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('button')).toBeNull();
  },
);

test('shows teacher blocks like student blocks without disabling editing', () => {
  renderNode(
    nodeProps({
      id: 'teacher-blocked-node',
      data: {
        title: 'Contenido bloqueado por docencia',
        status: 'editing',
        isTeacherBlocked: true,
      },
    }),
  );

  const card = screen.getByTestId('roadmap-card');
  expect(screen.queryByText('Bloqueado por docencia')).toBeNull();
  expect(screen.getByRole('img', { name: 'Bloqueado por docencia' })).toBeTruthy();
  expect(card.style.backgroundColor).toBe('color-mix(in srgb, var(--blocked) 20%, var(--card))');
  expect(card.style.borderColor).toBe('var(--blocked)');
  expect(card.className).toContain('cursor-pointer');
  expect(card.getAttribute('aria-disabled')).toBeNull();
});

test('sizes cards from their titles in grid-aligned dimensions', () => {
  const sizedProps = (data: Partial<RoadmapFlowNode['data']>) =>
    studentNodeProps({ id: crypto.randomUUID(), data });

  render(
    <ReactFlowProvider>
      <RoadmapNode {...sizedProps({ title: 'Breve' })} />
      <RoadmapNode
        {...sizedProps({
          title:
            'Un título deliberadamente muy largo que ocuparía más de dos líneas sin recortarse',
        })}
      />
      <RoadmapNode {...sizedProps({ title: 'Oculto', status: 'editing', isHidden: true })} />
      <RoadmapNode
        {...sizedProps({
          title: 'Bloqueado',
          status: 'locked',
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
  expect(cards[1].style.height).toBe(cards[0].style.height);
});

test('clamps long card titles to two lines while preserving the full title as a tooltip', () => {
  const title = 'Un título deliberadamente muy largo que ocuparía más de dos líneas sin recortarse';
  renderNode(studentNodeProps({ id: 'long-title', data: { title } }));

  const heading = screen.getByText(title);
  const content = screen.getByTestId('roadmap-node-content');
  expect(content.className).toContain('h-full');
  expect(content.className).toContain('items-center');
  expect(content.className).toContain('justify-start');
  expect(heading.getAttribute('title')).toBe(title);
  expect(heading.className).toContain('line-clamp-2');
  expect(heading.className).toContain('wrap-break-word');
  expect(heading.className).toContain('text-left');
});

function mountChangedNode(data: Partial<RoadmapFlowNode['data']>) {
  const fetch = vi.fn(async () => Response.json({ byNode: { 'changed-node': 3 } }));
  vi.stubGlobal('fetch', fetch);
  render(
    <NodeChangeCountsProvider roadmapId="roadmap" enabled>
      <ReactFlowProvider>
        <RoadmapNode
          {...studentNodeProps({
            id: 'changed-node',
            data: {
              title: 'Variables',
              roadmapId: 'roadmap',
              notificationsEnabled: true,
              status: 'editing',
              linkCount: 1,
              ...data,
            },
          })}
        />
      </ReactFlowProvider>
    </NodeChangeCountsProvider>,
  );
  return fetch;
}

test.each([
  ['a visible Node', {}],
  ['a hidden Node in the teaching view', { isHidden: true }],
  ['a Teacher-blocked Node in the teaching view', { isTeacherBlocked: true }],
])('marks unreviewed changes of %s with a red count opposite the resources', async (_, data) => {
  mountChangedNode(data);
  const badge = await screen.findByRole('img', { name: '3 cambios sin revisar' });
  expect(badge.textContent).toBe('3');
  expect(badge.className).toContain('bg-destructive');
  expect(badge.className).toContain('left-[-10px]');
  expect(screen.getByTestId('roadmap-node-resources').className).toContain('right-[-10px]');
});

test('does not mark a Node its student cannot open', async () => {
  const fetch = mountChangedNode({ status: 'locked', blockReason: 'PREREQUISITE_BLOCK' });
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(screen.queryByRole('img', { name: /cambios? sin revisar/ })).toBeNull();
});
