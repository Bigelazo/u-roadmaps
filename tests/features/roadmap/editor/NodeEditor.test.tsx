import { createRef, type ComponentProps } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { NodeEditor } from '@/features/roadmap/editor/NodeEditor';
import type {
  NodeEditorHandle,
  NodeEditorIntent,
  NodeEditorPerformResult,
  NodeEditorProps,
} from '@/features/roadmap/editor/types';
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
  isVisible: true,
  isTeacherBlocked: true,
  resources: [],
};

const resource = {
  id: 'resource-1',
  title: 'Guía de ejercicios',
  url: 'https://example.test/guia',
  type: 'LINK' as const,
};

const nodeTypes: RoadmapDto['nodeTypes'] = [
  {
    id: 'content',
    name: 'Contenido',
    icon: 'BookOpen',
    color: '#024AD8',
    isPredefined: true,
  },
  {
    id: 'assessment',
    name: 'Evaluación',
    icon: 'ClipboardCheck',
    color: '#B42355',
    isPredefined: true,
  },
];

function renderEditor(
  overrides: Partial<NodeEditorProps> = {},
  ref = createRef<NodeEditorHandle>(),
) {
  const perform = vi
    .fn<
      (
        effect: Parameters<NonNullable<NodeEditorProps['perform']>>[0],
      ) => Promise<NodeEditorPerformResult>
    >()
    .mockResolvedValue({ status: 'committed' });
  const onIntent = vi.fn<(intent: NodeEditorIntent) => void>();
  const props: NodeEditorProps = {
    node,
    nodeTypes,
    isVisibilityPending: false,
    perform,
    onIntent,
    ...overrides,
  };
  const view = render(
    <SidebarProvider>
      <NodeEditorPanel isOpen panelWidth={360} onPanelWidthChange={vi.fn()}>
        <NodeEditor {...props} ref={ref} />
      </NodeEditorPanel>
    </SidebarProvider>,
  );
  return { ...view, props, perform, onIntent, ref };
}

test('renders the selected Node as one cohesive editing surface', () => {
  renderEditor();

  expect(screen.getByRole('heading', { name: node.title })).toBeTruthy();
  expect(screen.getByTestId('node-type-icon')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Estado del hito' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Recursos/ })).toBeTruthy();
});

test('saves Node information through one perform effect and preserves rejected input', async () => {
  const user = userEvent.setup();
  const view = renderEditor();
  const { perform } = view;
  const title = screen.getByLabelText('Título');

  expect(
    (screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  await user.clear(title);
  await user.type(title, 'Límites y continuidad');
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

  expect(perform).toHaveBeenCalledWith({
    kind: 'update-node',
    nodeId: node.id,
    value: {
      title: 'Límites y continuidad',
      description: node.description,
      nodeTypeId: node.nodeTypeId,
    },
  });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled,
    ).toBe(true),
  );

  view.unmount();
  const rejectedPerform = vi.fn().mockResolvedValue({ status: 'rejected' } as const);
  const { unmount } = renderEditor({ perform: rejectedPerform });
  const rejectedTitle = screen.getAllByLabelText('Título').at(-1)!;
  await user.clear(rejectedTitle);
  await user.type(rejectedTitle, 'Borrador recuperable');
  await user.click(screen.getAllByRole('button', { name: 'Guardar cambios' }).at(-1)!);
  await waitFor(() => expect(rejectedPerform).toHaveBeenCalled());
  expect((screen.getAllByLabelText('Título').at(-1)! as HTMLInputElement).value).toBe(
    'Borrador recuperable',
  );
  unmount();
});

test('normalizes a thrown Node save failure and keeps the retryable draft', async () => {
  const user = userEvent.setup();
  const perform = vi.fn().mockRejectedValue(new Error('network failure'));
  renderEditor({ perform });

  await user.clear(screen.getByLabelText('Título'));
  await user.type(screen.getByLabelText('Título'), 'Borrador recuperable');
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

  await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador recuperable');
  expect(
    (screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled,
  ).toBe(false);
});

test('keeps an empty Resource composer clean and uses the finite link session for additions', async () => {
  const user = userEvent.setup();
  const { perform } = renderEditor();

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  expect(screen.getByRole('button', { name: 'Previsualizar' })).toBeTruthy();
  await user.click(screen.getByRole('tab', { name: 'Enlace' }));
  await user.type(screen.getByPlaceholderText('Ej. Guía de ejercicios'), 'Guía nueva');
  await user.type(screen.getByLabelText('Enlace'), 'https://example.test/nueva');
  expect(screen.getByRole('button', { name: 'Previsualizar cambios' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Agregar enlace' }));

  expect(perform).toHaveBeenCalledWith({
    kind: 'add-resource',
    nodeId: node.id,
    resource: { title: 'Guía nueva', url: 'https://example.test/nueva', type: 'LINK' },
  });
  await waitFor(() => expect(screen.queryByText('Nuevo recurso')).toBeNull());
});

test('does not guard a dirty Node when opening a Resource for that same Node', async () => {
  const user = userEvent.setup();
  const ref = createRef<NodeEditorHandle>();
  renderEditor({}, ref);

  await user.clear(screen.getByLabelText('Título'));
  await user.type(screen.getByLabelText('Título'), 'Borrador');

  await expect(ref.current!.guardDraft({ kind: 'open-resource', nodeId: node.id })).resolves.toBe(
    true,
  );
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('uploads a selected file and keeps the resource session on rejection', async () => {
  const user = userEvent.setup();
  const perform = vi.fn().mockResolvedValue({ status: 'rejected' } as const);
  renderEditor({ perform });

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  const file = new File(['guía'], 'guia-1.pdf', { type: 'application/pdf' });
  await user.upload(screen.getByLabelText('Archivo'), file);
  await user.click(screen.getByRole('button', { name: 'Subir archivo' }));

  expect(perform).toHaveBeenCalledWith({ kind: 'upload-resource', nodeId: node.id, file });
  await screen.findByText('guia-1.pdf');
});

test('does not let a late Resource result clear a newer Resource session', async () => {
  const user = userEvent.setup();
  let resolvePerform!: (result: NodeEditorPerformResult) => void;
  const perform = vi.fn(
    () =>
      new Promise<NodeEditorPerformResult>((resolve) => {
        resolvePerform = resolve;
      }),
  );
  renderEditor({ perform });

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await user.click(screen.getByRole('tab', { name: 'Enlace' }));
  await user.type(screen.getByPlaceholderText('Ej. Guía de ejercicios'), 'Primera versión');
  await user.type(screen.getByLabelText('Enlace'), 'https://example.test/primera');
  await user.click(screen.getByRole('button', { name: 'Agregar enlace' }));
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));

  const title = screen.getByPlaceholderText('Ej. Guía de ejercicios');
  await user.clear(title);
  await user.type(title, 'Versión más nueva');
  resolvePerform({ status: 'committed' });

  await waitFor(() => expect((title as HTMLInputElement).value).toBe('Versión más nueva'));
  expect(screen.getByText('Nuevo recurso')).toBeTruthy();
});

test('does not let a late Resource result clear a reopened session with the same input', async () => {
  const user = userEvent.setup();
  let resolvePerform!: (result: NodeEditorPerformResult) => void;
  const perform = vi.fn(
    () =>
      new Promise<NodeEditorPerformResult>((resolve) => {
        resolvePerform = resolve;
      }),
  );
  renderEditor({ perform });

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await user.click(screen.getByRole('tab', { name: 'Enlace' }));
  await user.type(screen.getByPlaceholderText('Ej. Guía de ejercicios'), 'Guía temporal');
  await user.type(screen.getByLabelText('Enlace'), 'https://example.test/temporal');
  await user.click(screen.getByRole('button', { name: 'Agregar enlace' }));
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));

  await user.click(screen.getByRole('button', { name: 'Cerrar editor de recurso' }));
  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await user.click(screen.getByRole('tab', { name: 'Enlace' }));
  await user.type(screen.getByPlaceholderText('Ej. Guía de ejercicios'), 'Guía temporal');
  await user.type(screen.getByLabelText('Enlace'), 'https://example.test/temporal');

  resolvePerform({ status: 'committed' });
  await screen.findByText('Nuevo recurso');
  expect((screen.getByPlaceholderText('Ej. Guía de ejercicios') as HTMLInputElement).value).toBe(
    'Guía temporal',
  );
});

test('edits an existing Resource and retries a failed deletion through the same session', async () => {
  const user = userEvent.setup();
  const perform = vi
    .fn()
    .mockResolvedValueOnce({ status: 'committed' })
    .mockResolvedValueOnce({ status: 'rejected' })
    .mockResolvedValueOnce({ status: 'committed' });
  renderEditor({ node: { ...node, resources: [resource] }, perform });

  await user.click(screen.getByRole('button', { name: 'Editar recurso Guía de ejercicios' }));
  await user.clear(screen.getByPlaceholderText('Ej. Guía de ejercicios'));
  await user.type(screen.getByPlaceholderText('Ej. Guía de ejercicios'), 'Guía actualizada');
  await user.click(screen.getByRole('button', { name: 'Guardar enlace' }));
  expect(perform).toHaveBeenCalledWith({
    kind: 'update-resource',
    resourceId: resource.id,
    resource: { title: 'Guía actualizada', url: resource.url, type: resource.type },
  });

  await user.click(screen.getByRole('button', { name: 'Eliminar recurso Guía de ejercicios' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Confirmar eliminación' });
  await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('alertdialog', { name: 'Confirmar eliminación' })).toBeTruthy();
  await user.click(
    within(screen.getByRole('alertdialog', { name: 'Confirmar eliminación' })).getByRole('button', {
      name: 'Eliminar',
    }),
  );
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('guards a dirty transition and resets only after confirmed discard', async () => {
  const user = userEvent.setup();
  const ref = createRef<NodeEditorHandle>();
  renderEditor({}, ref);
  await user.clear(screen.getByLabelText('Título'));
  await user.type(screen.getByLabelText('Título'), 'Borrador');

  const decision = ref.current!.guardDraft({ kind: 'deselect-node', nodeId: node.id });
  await screen.findByRole('alertdialog', { name: 'Descartar cambios sin guardar' });
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  await expect(decision).resolves.toBe(false);
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador');

  const confirmed = ref.current!.guardDraft({ kind: 'deselect-node', nodeId: node.id });
  await screen.findByRole('alertdialog', { name: 'Descartar cambios sin guardar' });
  await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));
  await expect(confirmed).resolves.toBe(true);
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(node.title);
});

test('projects the current draft through a preview intent and carries an opaque focus callback', async () => {
  const user = userEvent.setup();
  const { onIntent } = renderEditor();
  await user.clear(screen.getByLabelText('Título'));
  await user.type(screen.getByLabelText('Título'), 'Límites y continuidad');
  await user.click(screen.getByRole('button', { name: 'Previsualizar cambios' }));

  const intent = onIntent.mock.calls.at(-1)?.[0];
  expect(intent).toMatchObject({
    kind: 'preview-node-information',
    node: { title: 'Límites y continuidad', isVisible: true, access: { status: 'ACCESSIBLE' } },
    returnFocus: expect.any(Function),
  });
});

test('consumes a typed Resource command once and focuses its composer', async () => {
  const command = {
    id: 'command-1',
    kind: 'open-resource' as const,
    nodeId: node.id,
    mode: 'file' as const,
  };
  renderEditor({ command });

  const file = await screen.findByLabelText('Archivo');
  await waitFor(() => expect(file.matches(':focus')).toBe(true));
  expect(screen.getAllByText('Nuevo recurso')).toHaveLength(1);
});

test('preserves a dirty draft while a same-Node canonical refresh updates its baseline', async () => {
  const user = userEvent.setup();
  const props: ComponentProps<typeof NodeEditor> = {
    node,
    nodeTypes,
    isVisibilityPending: false,
    perform: vi.fn().mockResolvedValue({ status: 'committed' }),
    onIntent: vi.fn(),
  };
  const { rerender } = render(
    <SidebarProvider>
      <NodeEditorPanel isOpen panelWidth={360} onPanelWidthChange={vi.fn()}>
        <NodeEditor {...props} />
      </NodeEditorPanel>
    </SidebarProvider>,
  );
  await user.clear(screen.getByLabelText('Título'));
  await user.type(screen.getByLabelText('Título'), 'Borrador');
  rerender(
    <SidebarProvider>
      <NodeEditorPanel isOpen panelWidth={360} onPanelWidthChange={vi.fn()}>
        <NodeEditor {...props} node={{ ...node, title: 'Cambio autorizado externamente' }} />
      </NodeEditorPanel>
    </SidebarProvider>,
  );
  await waitFor(() =>
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador'),
  );
  expect(screen.getByRole('button', { name: 'Previsualizar cambios' })).toBeTruthy();
});

test('does not let a late Node result replace a refreshed same-Node baseline', async () => {
  const user = userEvent.setup();
  let resolvePerform!: (result: NodeEditorPerformResult) => void;
  const perform = vi.fn(
    () =>
      new Promise<NodeEditorPerformResult>((resolve) => {
        resolvePerform = resolve;
      }),
  );
  const props: ComponentProps<typeof NodeEditor> = {
    node,
    nodeTypes,
    isVisibilityPending: false,
    perform,
    onIntent: vi.fn(),
  };
  const { rerender } = render(
    <SidebarProvider>
      <NodeEditorPanel isOpen panelWidth={360} onPanelWidthChange={vi.fn()}>
        <NodeEditor {...props} />
      </NodeEditorPanel>
    </SidebarProvider>,
  );

  await user.clear(screen.getByLabelText('Título'));
  await user.type(screen.getByLabelText('Título'), 'Borrador local');
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));

  rerender(
    <SidebarProvider>
      <NodeEditorPanel isOpen panelWidth={360} onPanelWidthChange={vi.fn()}>
        <NodeEditor {...props} node={{ ...node, title: 'Cambio autorizado externamente' }} />
      </NodeEditorPanel>
    </SidebarProvider>,
  );
  await screen.findByRole('heading', { name: 'Cambio autorizado externamente' });

  resolvePerform({ status: 'committed' });
  await screen.findByRole('button', { name: 'Previsualizar cambios' });
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador local');
});
