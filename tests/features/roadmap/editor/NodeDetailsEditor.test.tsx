import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { expect, test, vi } from 'vitest';
import { NodeDetailsEditor } from '@/features/roadmap/editor/NodeDetailsEditor';
import type { RoadmapNode } from '@/features/roadmap/types';

const node: RoadmapNode = {
  id: 'node-1',
  title: 'Límites',
  description: null,
  positionX: 0,
  positionY: 0,
  nodeTypeId: 'content',
  isVisible: true,
  isTeacherBlocked: false,
  resources: [],
};

function renderEditor(overrides: Partial<ComponentProps<typeof NodeDetailsEditor>> = {}) {
  const props: ComponentProps<typeof NodeDetailsEditor> = {
    node,
    nodeTypes: [{ id: 'content', name: 'Contenido', color: '#024AD8', isPredefined: true }],
    nodeValue: { title: node.title, description: '', nodeTypeId: node.nodeTypeId },
    resourceValue: { title: '', url: '', type: 'LINK' },
    editingResourceId: null,
    onNodeChange: vi.fn(),
    onResourceChange: vi.fn(),
    onUpdateNode: vi.fn(),
    onToggleVisibility: vi.fn(),
    onRequestTeacherBlock: vi.fn(),
    onAddResource: vi.fn().mockResolvedValue(true),
    onUploadResource: vi.fn().mockResolvedValue(true),
    onUpdateResource: vi.fn(),
    onStartEditingResource: vi.fn(),
    onCancelResource: vi.fn(),
    onDeleteNode: vi.fn(),
    onDeleteResource: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<NodeDetailsEditor {...props} />), props };
}

test('uploads a resource selected from the computer', async () => {
  const user = userEvent.setup();
  const { props } = renderEditor();

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  expect(screen.getByText('Arrastra un archivo aquí')).toBeTruthy();

  const file = new File(['guía'], 'guia-1.pdf', { type: 'application/pdf' });
  await user.upload(screen.getByLabelText('Archivo'), file);
  await user.click(screen.getByRole('button', { name: 'Subir archivo' }));

  expect(props.onUploadResource).toHaveBeenCalledWith(node.id, file);
  expect(props.onUpdateNode).not.toHaveBeenCalled();
});

test('shows the teacher-block state without restricting node editing', async () => {
  const user = userEvent.setup();
  const onRequestTeacherBlock = vi.fn();
  renderEditor({ onRequestTeacherBlock });

  expect(screen.getByText('Sin bloqueo docente')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Bloquear acceso' }));
  expect(onRequestTeacherBlock).toHaveBeenCalledWith(node.id, 'BLOCK');
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
});

test('offers individual and branch unlock actions for a teacher-blocked node', async () => {
  const user = userEvent.setup();
  const onRequestTeacherBlock = vi.fn();
  renderEditor({
    node: { ...node, isTeacherBlocked: true },
    onRequestTeacherBlock,
  });

  expect(screen.getByText('Bloqueado por docencia')).toBeTruthy();
  expect(screen.getByText(/no podrá desbloquearse de forma individual/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Desbloquear este nodo' }));
  await user.click(screen.getByRole('button', { name: 'Desbloquear rama' }));

  expect(onRequestTeacherBlock).toHaveBeenNthCalledWith(1, node.id, 'UNBLOCK');
  expect(onRequestTeacherBlock).toHaveBeenNthCalledWith(2, node.id, 'BRANCH_UNLOCK');
});

test('adds an external link with its title', async () => {
  const user = userEvent.setup();
  const onAddResource = vi.fn().mockResolvedValue(true);
  let resourceValue: ComponentProps<typeof NodeDetailsEditor>['resourceValue'] = {
    title: '',
    url: '',
    type: 'LINK',
  };
  const { rerender, props } = renderEditor({
    resourceValue,
    onAddResource,
    onResourceChange: (value) => {
      resourceValue = value;
      rerender(<NodeDetailsEditor {...props} resourceValue={resourceValue} />);
    },
  });

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await user.click(screen.getByRole('tab', { name: 'Enlace' }));
  await user.type(screen.getByPlaceholderText('Ej. Guía de ejercicios'), 'Guía de ejercicios');
  await user.type(screen.getByLabelText('Enlace'), 'https://example.test/guia');
  await user.click(screen.getByRole('button', { name: 'Agregar enlace' }));

  expect(onAddResource).toHaveBeenCalledWith(node.id, {
    title: 'Guía de ejercicios',
    url: 'https://example.test/guia',
    type: 'LINK',
  });
});
