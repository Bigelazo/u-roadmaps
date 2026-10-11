import { type ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import type { NodeType, RoadmapNode, StudentBlockedRoadmapNode } from '@/features/roadmap/types';
import { mockViewport } from '../../../support/viewport';

beforeEach(() => mockViewport(640));
afterEach(() => vi.unstubAllGlobals());

const node: RoadmapNode = {
  id: 'node-1',
  title: 'Introduccion a algoritmos',
  description: 'Conceptos basicos',
  nodeTypeId: 'type-1',
  positionX: 0,
  positionY: 0,
  isVisible: true,
  isTeacherBlocked: false,
  isCompleted: false,
  canComplete: true,
  resources: [],
};

const nodeWithResources = {
  ...node,
  resources: [
    {
      id: 'resource-1',
      title: 'Guia de estudio',
      type: 'FILE' as const,
      url: 'https://example.com/guide.pdf',
    },
    {
      id: 'resource-2',
      title: 'Clase grabada',
      type: 'VIDEO' as const,
      url: 'https://example.com/class',
    },
  ],
};

const blockedNode: StudentBlockedRoadmapNode = {
  id: 'blocked-node',
  title: 'Contenido bloqueado',
  nodeTypeId: 'type-1',
  positionX: 0,
  positionY: 0,
  access: { status: 'BLOCKED', reason: 'TEACHER_BLOCK' },
};

const nodeTypes: NodeType[] = [
  {
    id: 'type-1',
    name: 'Contenido',
    icon: 'ClipboardCheck',
    color: '#024AD8',
    isPredefined: true,
  },
];

/** Renders the detail of an available `node` with inert callbacks unless overridden. */
function renderDetail(props: Partial<ComponentProps<typeof StudentNodeDetail>> = {}) {
  return render(
    <StudentNodeDetail
      node={node}
      status="available"
      onClose={vi.fn()}
      onComplete={vi.fn()}
      {...props}
    />,
  );
}

test('fullscreen shows node content and Escape returns to the selected node', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  renderDetail({ onClose });

  await user.click(screen.getByRole('button', { name: 'Ver nodo en pantalla completa' }));
  const dialog = screen.getByRole('dialog', { name: node.title });
  expect(within(dialog).getByRole('button', { name: 'Cerrar pantalla completa' })).toBeTruthy();
  expect(within(dialog).getByText(node.title)).toBeTruthy();
  expect(within(dialog).getByText(node.description!)).toBeTruthy();

  await user.keyboard('{Escape}');
  expect(screen.queryByRole('button', { name: 'Cerrar pantalla completa' })).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: node.title })).toBeTruthy();
});

test('restricted student nodes do not offer fullscreen content', () => {
  renderDetail({ node: blockedNode, status: 'locked' });
  expect(screen.queryByRole('button', { name: 'Ver nodo en pantalla completa' })).toBeNull();
});

test('student can close a named mobile node-detail dialog with Escape or its close control', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();

  renderDetail({ onClose });

  expect(screen.getByRole('dialog', { name: node.title }).getAttribute('aria-modal')).toBe('true');

  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('student can complete an available node and open every resource in a new tab', async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();

  renderDetail({ node: nodeWithResources, onComplete });

  await user.click(screen.getByRole('button', { name: 'Completar' }));
  expect(onComplete).toHaveBeenCalledWith(nodeWithResources);

  const guide = screen.getByRole('link', { name: /Guia de estudio/i });
  expect(guide.getAttribute('href')).toBe(nodeWithResources.resources[0].url);
  expect(guide.getAttribute('target')).toBe('_blank');
  expect(guide.getAttribute('rel')).toBe('noreferrer');
  expect(screen.getByRole('link', { name: /Clase grabada/i }).getAttribute('href')).toBe(
    nodeWithResources.resources[1].url,
  );
});

test('student cannot complete a completed node', () => {
  renderDetail({ status: 'completed' });

  const completedButton = screen.getByRole('button', { name: 'Completado' }) as HTMLButtonElement;
  expect(completedButton.disabled).toBe(true);
});

test('student cannot complete a locked node and is told why', () => {
  renderDetail({ status: 'locked' });

  const lockedButton = screen.getByRole('button', {
    name: 'Completa prerrequisitos',
  }) as HTMLButtonElement;
  expect(lockedButton.disabled).toBe(true);
  expect(
    screen.getByText('Este nodo se desbloquea cuando completes sus prerrequisitos.'),
  ).toBeTruthy();
});

test.each(['TEACHER_BLOCK', 'PREREQUISITE_BLOCK'] as const)(
  'does not open a detail surface for a %s node',
  (reason) => {
    renderDetail({
      node: { ...blockedNode, access: { status: 'BLOCKED', reason } },
      status: 'locked',
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(blockedNode.title)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  },
);

test('does not render a desktop detail sidebar when no node is selected', () => {
  mockViewport(1280);

  renderDetail({ node: undefined, status: null });

  expect(screen.queryByText('Selecciona un nodo')).toBeNull();
});

test('uses the student profile width and exposes a desktop resize control', () => {
  mockViewport(1280);
  const onPanelWidthChange = vi.fn();

  renderDetail({ panelWidth: 460, onPanelWidthChange });

  const separator = screen.getByRole('separator', { name: 'Redimensionar detalle del nodo' });
  expect(separator.getAttribute('aria-valuenow')).toBe('460');
  fireEvent.keyDown(separator, { key: 'ArrowLeft' });
  expect(onPanelWidthChange).toHaveBeenCalledWith(440);
});

test('uses the selected-node header and keeps completion next to the close action', () => {
  mockViewport(1280);

  renderDetail({ nodeTypes });

  expect(screen.getByText('Nodo seleccionado')).toBeTruthy();
  expect(screen.getByTestId('student-node-type-icon').getAttribute('style')).toContain(
    'rgb(2, 74, 216)',
  );
  const actions = screen.getByRole('group', { name: 'Acciones del nodo' });
  expect(
    within(actions)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent),
  ).toEqual(['Completar', 'Ver nodo en pantalla completa', 'Cerrar detalle']);
  expect(screen.getByRole('button', { name: 'Completar' }).className).toContain('bg-emerald-600');
  const panel = screen.getByLabelText(node.title);
  expect(panel.className).toContain('shadow-(--shadow-roadmap-panel)');
});
