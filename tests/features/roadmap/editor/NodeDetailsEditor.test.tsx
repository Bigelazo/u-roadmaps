import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ComponentProps } from 'react';
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
    nodeTypes: [
      { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
    ],
    nodeValue: { title: node.title, description: '', nodeTypeId: node.nodeTypeId },
    resourceValue: { title: '', url: '', type: 'LINK' },
    editingResourceId: null,
    isResourceComposerOpen: false,
    resourceMode: 'file',
    selectedResourceFile: null,
    isDirty: false,
    onNodeChange: vi.fn(),
    onResourceChange: vi.fn(),
    onResourceComposerOpen: vi.fn(),
    onResourceComposerClose: vi.fn(),
    onResourceModeChange: vi.fn(),
    onSelectedResourceFileChange: vi.fn(),
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
    onPreview: vi.fn(),
    previewButtonRef: createRef<HTMLButtonElement>(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<NodeDetailsEditor {...props} />), props };
}

test('wraps the selected node title in the editor header without truncating it', () => {
  const title = 'Un título de nodo extremadamente largo que debe mostrarse completo en el editor';
  renderEditor({ node: { ...node, title } });

  const heading = screen.getByRole('heading', { name: title });
  expect(heading.className).not.toContain('truncate');
  expect(heading.className).toContain('wrap-break-word');
});

test('places the node-type icon alongside the title without repeating the type as a subtitle', () => {
  renderEditor();

  expect(screen.getByTestId('node-type-icon')).toBeTruthy();
  expect(screen.queryByText('Contenido', { selector: 'p' })).toBeNull();
});

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

test('groups visibility and teacher access under the node status without restricting node editing', async () => {
  const user = userEvent.setup();
  const onRequestTeacherBlock = vi.fn();
  const onToggleVisibility = vi.fn();
  renderEditor({ onRequestTeacherBlock, onToggleVisibility });

  expect(screen.getByRole('heading', { name: 'Estado del hito' })).toBeTruthy();
  expect(screen.getByText('Sin restricciones docentes')).toBeTruthy();
  await user.click(screen.getByRole('switch', { name: 'Visible para estudiantes' }));
  expect(onToggleVisibility).toHaveBeenCalledWith(node.id, true);
  await user.click(screen.getByRole('button', { name: 'Restringir acceso' }));
  expect(onRequestTeacherBlock).toHaveBeenCalledWith(node.id, 'BLOCK');
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
});

test('explains that student access does not apply while the node is hidden', () => {
  renderEditor({ node: { ...node, isVisible: false, isTeacherBlocked: false } });

  expect(screen.getByText('El acceso se habilitará cuando el hito sea visible.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Restringir acceso' })).toBeNull();
});

test('enables saving only after the node form changes', async () => {
  const user = userEvent.setup();
  const onUpdateNode = vi.fn().mockResolvedValue(true);
  const { props, rerender } = renderEditor({ onUpdateNode });

  const saveButton = screen.getByRole('button', { name: 'Guardar cambios' });
  expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  await user.click(saveButton);
  expect(onUpdateNode).not.toHaveBeenCalled();

  rerender(
    <NodeDetailsEditor
      {...props}
      nodeValue={{ ...props.nodeValue, title: 'Límites y continuidad' }}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(onUpdateNode).toHaveBeenCalledWith(node.id, {
    title: 'Límites y continuidad',
    description: '',
    nodeTypeId: 'content',
  });
});

test('labels the secondary eye action from the shared dirty state', () => {
  const { props, rerender } = renderEditor();
  expect(screen.getByRole('button', { name: 'Previsualizar' })).toBeTruthy();

  rerender(<NodeDetailsEditor {...props} isDirty />);

  expect(screen.getByRole('button', { name: 'Previsualizar cambios' })).toBeTruthy();
});

test('offers individual and branch unlock actions for a teacher-blocked node', async () => {
  const user = userEvent.setup();
  const onRequestTeacherBlock = vi.fn();
  renderEditor({
    node: { ...node, isTeacherBlocked: true },
    onRequestTeacherBlock,
  });

  expect(screen.getByText('Acceso restringido por docencia')).toBeTruthy();
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
  expect(
    (screen.getByRole('button', { name: 'Agregar enlace' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  await user.type(screen.getByPlaceholderText('Ej. Guía de ejercicios'), 'Guía de ejercicios');
  await user.type(screen.getByLabelText('Enlace'), 'https://example.test/guia');
  await user.click(screen.getByRole('button', { name: 'Agregar enlace' }));

  expect(onAddResource).toHaveBeenCalledWith(node.id, {
    title: 'Guía de ejercicios',
    url: 'https://example.test/guia',
    type: 'LINK',
  });
});

test('enables saving an edited link only after it changes', async () => {
  const user = userEvent.setup();
  const resource = {
    id: 'resource-1',
    title: 'Guía de ejercicios',
    url: 'https://example.test/guia',
    type: 'LINK' as const,
  };
  const onUpdateResource = vi.fn().mockResolvedValue(true);
  let resourceValue: ComponentProps<typeof NodeDetailsEditor>['resourceValue'] = {
    title: '',
    url: '',
    type: 'LINK',
  };
  let editingResourceId: string | null = null;
  const { rerender, props } = renderEditor({
    node: { ...node, resources: [resource] },
    resourceValue,
    editingResourceId,
    onUpdateResource,
    onStartEditingResource: (item) => {
      editingResourceId = item.id;
      resourceValue = { title: item.title, url: item.url, type: item.type };
      rerender(
        <NodeDetailsEditor
          {...props}
          resourceValue={resourceValue}
          editingResourceId={editingResourceId}
        />,
      );
    },
    onResourceChange: (value) => {
      resourceValue = value;
      rerender(
        <NodeDetailsEditor
          {...props}
          resourceValue={resourceValue}
          editingResourceId={editingResourceId}
        />,
      );
    },
  });

  await user.click(screen.getByRole('button', { name: 'Editar recurso Guía de ejercicios' }));
  const saveButton = await screen.findByRole('button', { name: 'Guardar enlace' });
  expect((saveButton as HTMLButtonElement).disabled).toBe(true);

  const resourceTitle = screen.getByPlaceholderText('Ej. Guía de ejercicios');
  await user.clear(resourceTitle);
  await user.type(resourceTitle, 'Guía actualizada');
  await user.click(screen.getByRole('button', { name: 'Guardar enlace' }));

  expect(onUpdateResource).toHaveBeenCalledWith(resource.id, {
    title: 'Guía actualizada',
    url: resource.url,
    type: 'LINK',
  });
});
