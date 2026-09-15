import { createRef } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { RoadmapEditor } from '@/features/roadmap/editor/RoadmapEditor';
import type { RoadmapEditorProps } from '@/features/roadmap/editor/types';
import type { RoadmapDto, RoadmapNode } from '@/features/roadmap/types';
import { NodeEditorPanel } from '@/features/roadmap/ui/NodeEditorPanel';
import { SidebarProvider } from '@/shared/ui/sidebar';

const node: RoadmapNode = {
  id: 'node-1',
  title: 'Límites',
  description: 'Información guardada',
  nodeTypeId: 'content',
  positionX: 0,
  positionY: 0,
  isVisible: true as const,
  isTeacherBlocked: true,
  resources: [],
};

const roadmap: RoadmapDto = {
  course: { code: 'CC1001', name: 'Programación I', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [
    {
      id: 'content',
      name: 'Contenido',
      icon: 'BookOpen' as const,
      color: '#024AD8',
      isPredefined: true,
    },
    {
      id: 'assessment',
      name: 'Evaluación',
      icon: 'BookOpen',
      color: '#024AD8',
      isPredefined: true,
    },
  ],
  nodes: [node],
  dependencies: [],
};

type EditorHarnessProps = RoadmapEditorProps & {
  isOpen?: boolean;
};

function EditorHarness({ isOpen = true, ...props }: EditorHarnessProps) {
  return (
    <NodeEditorPanel isOpen={isOpen} panelWidth={360} onPanelWidthChange={vi.fn()}>
      <RoadmapEditor {...props} />
    </NodeEditorPanel>
  );
}

function editorProps(overrides: Partial<EditorHarnessProps> = {}): EditorHarnessProps {
  return {
    roadmap,
    selectedNode: node,
    isVisibilityPending: false,
    onClose: vi.fn(),
    onUpdateNode: vi.fn().mockResolvedValue(true),
    onToggleVisibility: vi.fn().mockResolvedValue(true),
    onRequestTeacherBlock: vi.fn(),
    onDeleteNode: vi.fn().mockResolvedValue(true),
    onAddResource: vi.fn().mockResolvedValue(true),
    onUploadResource: vi.fn().mockResolvedValue(true),
    onUpdateResource: vi.fn().mockResolvedValue(true),
    onDeleteResource: vi.fn().mockResolvedValue(true),
    onPreview: vi.fn(),
    previewButtonRef: createRef<HTMLButtonElement>(),
    ...overrides,
  };
}

test('keeps the node-information draft when returning from the full-canvas preview', async () => {
  const user = userEvent.setup();
  const props = editorProps();
  const { rerender } = render(
    <SidebarProvider>
      <EditorHarness {...props} />
    </SidebarProvider>,
  );

  const title = await screen.findByLabelText('Título');
  await user.clear(title);
  await user.type(title, 'Límites y continuidad');
  expect(screen.getByRole('button', { name: 'Previsualizar cambios' })).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Previsualizar cambios' }));
  expect(props.onPreview).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Límites y continuidad',
      access: { status: 'ACCESSIBLE' },
      canComplete: true,
    }),
  );

  rerender(
    <SidebarProvider>
      <EditorHarness {...props} isOpen={false} />
    </SidebarProvider>,
  );
  rerender(
    <SidebarProvider>
      <EditorHarness {...props} isOpen />
    </SidebarProvider>,
  );

  expect(((await screen.findByLabelText('Título')) as HTMLInputElement).value).toBe(
    'Límites y continuidad',
  );
});

test('continues treating a retained draft as dirty after the editor panel closes', async () => {
  const user = userEvent.setup();
  const props = editorProps();
  const { rerender } = render(
    <SidebarProvider>
      <EditorHarness {...props} />
    </SidebarProvider>,
  );

  await user.clear(await screen.findByLabelText('Título'));
  await user.type(screen.getByLabelText('Título'), 'Límites y continuidad');
  rerender(
    <SidebarProvider>
      <EditorHarness {...props} isOpen={false} />
    </SidebarProvider>,
  );
  rerender(
    <SidebarProvider>
      <EditorHarness {...props} isOpen />
    </SidebarProvider>,
  );

  expect(screen.getByRole('button', { name: 'Previsualizar cambios' })).toBeTruthy();
});

test('keeps an active resource draft when the panel is hidden and reopened', async () => {
  const user = userEvent.setup();
  const props = editorProps();
  const { rerender } = render(
    <SidebarProvider>
      <EditorHarness {...props} />
    </SidebarProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await user.click(screen.getByRole('tab', { name: 'Enlace' }));
  await user.type(screen.getByPlaceholderText('Ej. Guía de ejercicios'), 'Guía nueva');
  await user.type(screen.getByLabelText('Enlace'), 'https://example.test/nueva');

  rerender(
    <SidebarProvider>
      <EditorHarness {...props} isOpen={false} />
    </SidebarProvider>,
  );
  rerender(
    <SidebarProvider>
      <EditorHarness {...props} isOpen />
    </SidebarProvider>,
  );

  expect((screen.getByPlaceholderText('Ej. Guía de ejercicios') as HTMLInputElement).value).toBe(
    'Guía nueva',
  );
  expect((screen.getByLabelText('Enlace') as HTMLInputElement).value).toBe(
    'https://example.test/nueva',
  );
});

test('opens the existing resource composer and moves focus to its file field on request', async () => {
  render(
    <SidebarProvider>
      <EditorHarness {...editorProps({ resourceComposerRequest: 1 })} />
    </SidebarProvider>,
  );

  const file = await screen.findByLabelText('Archivo');
  await waitFor(() => expect(file.matches(':focus')).toBe(true));
});

test('confirms node deletion with declarative consequences and preserves a cancelled draft', async () => {
  const user = userEvent.setup();
  const resource = {
    id: 'resource-1',
    title: 'Guía de ejercicios',
    url: 'https://example.test/guia',
    type: 'LINK' as const,
  };
  const selectedNode = { ...node, resources: [resource] };
  const props = editorProps({
    roadmap: {
      ...roadmap,
      nodes: [{ ...node, id: 'node-0', title: 'Bases', resources: [] }, selectedNode],
      dependencies: [
        {
          id: 'dependency-1',
          sourceNodeId: 'node-0',
          targetNodeId: selectedNode.id,
          sourceHandle: 'right' as const,
          targetHandle: 'left' as const,
        },
      ],
    },
    selectedNode,
  });

  render(
    <SidebarProvider>
      <EditorHarness {...props} />
    </SidebarProvider>,
  );

  const title = await screen.findByLabelText('Título');
  await user.clear(title);
  await user.type(title, 'Límites y continuidad');
  await user.click(screen.getByRole('button', { name: /^Eliminar$/ }));

  const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' });
  expect(dialog.getAttribute('data-intent')).toBe('destructive');
  expect(within(dialog).getByRole('listitem', { name: 'Límites' })).toBeTruthy();
  expect(within(dialog).getByText('Bases')).toBeTruthy();
  expect(within(dialog).getByText('Guía de ejercicios')).toBeTruthy();
  expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeTruthy();

  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

  expect(props.onDeleteNode).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Límites y continuidad');
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('keeps node deletion recoverable after an error and closes only after success', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onDeleteNode = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const props = editorProps({ onClose, onDeleteNode });

  render(
    <SidebarProvider>
      <EditorHarness {...props} />
    </SidebarProvider>,
  );

  await user.click(screen.getByRole('button', { name: /^Eliminar$/ }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' });
  const confirm = within(dialog).getByRole('button', { name: 'Eliminar Nodo' });

  await user.click(confirm);
  await waitFor(() => expect(onDeleteNode).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole('alertdialog', { name: 'Eliminar Nodo' })).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();

  await user.click(confirm);
  await waitFor(() => expect(onDeleteNode).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('confirms resource deletion and keeps the dialog open when the mutation fails', async () => {
  const user = userEvent.setup();
  const resource = {
    id: 'resource-1',
    title: 'Guía de ejercicios',
    url: 'https://example.test/guia',
    type: 'LINK' as const,
  };
  const onDeleteResource = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const props = editorProps({
    selectedNode: { ...node, resources: [resource] },
    onDeleteResource,
  });

  render(
    <SidebarProvider>
      <EditorHarness {...props} />
    </SidebarProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'Eliminar recurso Guía de ejercicios' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar eliminación' });
  expect(dialog.getAttribute('data-intent')).toBe('destructive');
  expect(within(dialog).getByRole('listitem', { name: 'Guía de ejercicios' })).toBeTruthy();

  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(onDeleteResource).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Eliminar recurso Guía de ejercicios' }));
  const retryDialog = await screen.findByRole('alertdialog', { name: 'Confirmar eliminación' });
  const confirm = within(retryDialog).getByRole('button', { name: 'Eliminar' });
  await user.click(confirm);
  await waitFor(() => expect(onDeleteResource).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole('alertdialog', { name: 'Confirmar eliminación' })).toBeTruthy();

  await user.click(confirm);
  await waitFor(() => expect(onDeleteResource).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});
