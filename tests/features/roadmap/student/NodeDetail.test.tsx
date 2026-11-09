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
      fileContentType: 'application/pdf',
      fileSize: 1_258_291,
      accessCount: 3,
      isReviewed: true,
      url: 'https://example.com/guide.pdf',
    },
    {
      id: 'resource-2',
      title: 'Clase grabada',
      type: 'LINK' as const,
      fileContentType: null,
      fileSize: null,
      accessCount: 1,
      isReviewed: true,
      url: 'https://example.com/class',
    },
  ],
};

const nodeWithUnreviewedLink = {
  ...nodeWithResources,
  resources: [
    nodeWithResources.resources[0],
    { ...nodeWithResources.resources[1], isReviewed: false },
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
  mockViewport(1280);
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
  expect(screen.getByLabelText(node.title).id).toBe('student-node-detail-panel');
});

test('compact node detail is the tutorial target sheet without a second fullscreen dialog', () => {
  renderDetail();

  const sheet = screen.getByRole('dialog', { name: node.title });
  expect(sheet.id).toBe('student-node-detail-panel');
  // eslint-disable-next-line testing-library/no-node-access -- the tutorial targets this id.
  expect(document.querySelectorAll('#student-node-detail-panel')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Ver nodo en pantalla completa' })).toBeNull();
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

  const guide = screen.getByRole('link', { name: 'Descargar Guia de estudio' });
  expect(guide.getAttribute('href')).toBe(nodeWithResources.resources[0].url);
  expect(guide.getAttribute('target')).toBe('_blank');
  expect(guide.getAttribute('rel')).toBe('noreferrer');
  expect(guide.innerHTML).toContain('lucide-file-text"');
  const recording = screen.getByRole('link', { name: 'Abrir enlace Clase grabada' });
  expect(recording.getAttribute('href')).toBe(nodeWithResources.resources[1].url);
  expect(recording.innerHTML).toContain('lucide-link-2"');
  expect(screen.queryByText(/Archivo descargable|Enlace externo/)).toBeNull();
});

test('each Resource row shows its access count, a File its size, and what the student reviewed', () => {
  renderDetail({ node: nodeWithUnreviewedLink });

  const guide = screen.getByRole('link', { name: 'Descargar Guia de estudio' });
  expect(within(guide).getByText('3 accesos')).toBeTruthy();
  expect(within(guide).getByText('1,2 MB')).toBeTruthy();
  expect(within(guide).getByText('Ya lo revisaste')).toBeTruthy();
  const recording = screen.getByRole('link', { name: 'Abrir enlace Clase grabada' });
  expect(within(recording).getByText('1 acceso')).toBeTruthy();
  expect(within(recording).queryByText(/MB|KB/)).toBeNull();
  expect(within(recording).queryByText('Ya lo revisaste')).toBeNull();
});

test('left click, middle click and keyboard activation of a Resource report an access', async () => {
  const user = userEvent.setup();
  const onResourceAccess = vi.fn();
  renderDetail({ node: nodeWithUnreviewedLink, onResourceAccess });
  const recording = screen.getByRole('link', { name: 'Abrir enlace Clase grabada' });
  recording.addEventListener('click', (event) => event.preventDefault());

  await user.click(recording);
  await user.pointer({ keys: '[MouseMiddle]', target: recording });
  recording.focus();
  await user.keyboard('{Enter}');

  expect(onResourceAccess).toHaveBeenCalledTimes(3);
  expect(onResourceAccess).toHaveBeenCalledWith(nodeWithUnreviewedLink.resources[1]);
});

test('Completar looks disabled while a Resource is unreviewed and a click or Enter only shows the hint', async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  renderDetail({ node: nodeWithUnreviewedLink, onComplete });

  const complete = screen.getByRole('button', { name: 'Completar' }) as HTMLButtonElement;
  expect(complete.disabled).toBe(false);
  expect(complete.getAttribute('aria-disabled')).toBe('true');
  expect(screen.queryByText('Revisa el material aunque sea po...')).toBeNull();

  await user.hover(complete);
  expect(screen.queryByText('Revisa el material aunque sea po...')).toBeNull();
  await user.click(complete);
  expect(screen.getAllByText('Revisa el material aunque sea po...').length).toBeGreaterThan(0);
  await user.keyboard('{Escape}');
  complete.focus();
  await user.keyboard('{Enter}');
  expect(screen.getAllByText('Revisa el material aunque sea po...').length).toBeGreaterThan(0);
  expect(onComplete).not.toHaveBeenCalled();
});

test('the editor student preview reviews a Resource locally before Completar works', async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  const onResourceAccess = vi.fn();
  const teachingNode = {
    ...nodeWithResources,
    resources: nodeWithResources.resources.map((resource) => ({
      ...resource,
      isReviewed: undefined,
    })),
  };
  renderDetail({ node: teachingNode, onComplete, onResourceAccess, isTeacherPreview: true });
  for (const link of screen.getAllByRole('link'))
    link.addEventListener('click', (event) => event.preventDefault());
  const complete = screen.getByRole('button', { name: 'Completar' });

  await user.click(complete);
  expect(onComplete).not.toHaveBeenCalled();
  await user.click(screen.getByRole('link', { name: 'Descargar Guia de estudio' }));
  await user.click(screen.getByRole('link', { name: 'Abrir enlace Clase grabada' }));
  expect(complete.getAttribute('aria-disabled')).toBeNull();
  await user.click(complete);

  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onResourceAccess).not.toHaveBeenCalled();
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

test('renders nothing when no node is selected', () => {
  mockViewport(1280);

  const { container } = renderDetail({ node: undefined, status: null });

  expect(container.innerHTML).toBe('');
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

test('lists Resources before the description, which shows without a heading', () => {
  renderDetail({ node: nodeWithResources });

  expect(screen.queryByRole('heading', { name: 'Descripción' })).toBeNull();
  const resources = screen.getByRole('heading', { name: 'Recursos' });
  const description = screen.getByText(node.description!);
  expect(
    resources.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getByRole('separator')).toBeTruthy();
});

test('a Node without Resources shows only its description', () => {
  renderDetail();

  expect(screen.queryByRole('heading', { name: 'Recursos' })).toBeNull();
  expect(screen.queryByText(/No hay recursos adjuntos/)).toBeNull();
  expect(screen.queryByRole('separator')).toBeNull();
  expect(screen.getByText(node.description!)).toBeTruthy();
});

test('Resource rows keep a 44px touch target', () => {
  renderDetail({ node: nodeWithResources });

  for (const link of screen.getAllByRole('link')) expect(link.className).toContain('min-h-11');
});
