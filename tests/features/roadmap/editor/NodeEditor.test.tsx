import { Activity, createRef } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
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
import { mockViewport } from '../../../support/viewport';

beforeEach(() => mockViewport(1280));
afterEach(() => vi.unstubAllGlobals());

test('switches Resource panels with arrow keys and names the active panel', async () => {
  const user = userEvent.setup();
  renderEditor();

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  const fileTab = screen.getByRole('tab', { name: 'Archivo' });
  await user.click(fileTab);
  expect(screen.getByRole('tabpanel', { name: 'Archivo' })).toBeTruthy();
  await user.keyboard('{ArrowRight}');

  const linkTab = screen.getByRole('tab', { name: 'Enlace' });
  expect(linkTab.matches(':focus')).toBe(true);
  expect(linkTab.getAttribute('aria-selected')).toBe('true');
  const panel = screen.getByRole('tabpanel', { name: 'Enlace' });
  expect(linkTab.getAttribute('aria-controls')).toBe(panel.id);
  expect(within(panel).getByLabelText('Enlace', { selector: 'input' })).toBeTruthy();
  expect(screen.queryByLabelText('Archivo', { selector: 'input' })).toBeNull();
});

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
  fileContentType: null,
  fileSize: null,
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
    color: '#DB2777',
    isPredefined: true,
  },
];

test.each(['Guía.docx', 'Guía.final.PDF', 'README', '.env'])(
  'renames the file %s while keeping its extension outside the editable title',
  async (title) => {
    const user = userEvent.setup();
    const file = { ...resource, title, type: 'FILE' as const };
    const { perform } = renderEditor(withNode({ resources: [file] }));
    await user.click(screen.getByRole('button', { name: `Editar recurso ${title}` }));
    const input = within(screen.getByRole('form', { name: 'Editor de recurso' })).getByRole(
      'textbox',
      { name: 'Título' },
    );
    const extension = title === 'Guía.docx' ? '.docx' : title === 'Guía.final.PDF' ? '.PDF' : '';
    expect((input as HTMLInputElement).value).toBe(
      extension ? title.slice(0, -extension.length) : title,
    );
    expect(input.getAttribute('aria-describedby')).toBe(extension ? 'resource-extension' : null);
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Guardar recurso' }));
    expect(screen.getByText('Escribe un título para el recurso.')).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(perform).not.toHaveBeenCalled();
    await user.type(input, 'Nombre actualizado');
    await user.click(screen.getByRole('button', { name: 'Guardar recurso' }));
    expect(perform).toHaveBeenCalledWith({
      kind: 'update-resource',
      resourceId: file.id,
      resource: { url: file.url, title: `Nombre actualizado${extension}`, type: 'FILE' },
    });
  },
);

test('replaces a file keeping the edited title, adopting the new extension, and can keep the current one', async () => {
  const user = userEvent.setup();
  const file = { ...resource, title: 'Guía.docx', type: 'FILE' as const };
  const { perform } = renderEditor(withNode({ resources: [file] }));
  await user.click(screen.getByRole('button', { name: 'Editar recurso Guía.docx' }));
  const form = screen.getByRole('form', { name: 'Editor de recurso' });
  const title = within(form).getByRole('textbox', { name: 'Título' });
  const save = within(form).getByRole('button', { name: 'Guardar recurso' });
  expect(save.hasAttribute('disabled')).toBe(true);
  await user.clear(title);
  await user.type(title, 'Guía resuelta');
  const replacement = new File(['pdf'], 'solucion.pdf', { type: 'application/pdf' });
  await user.upload(within(form).getByLabelText('Reemplazar archivo'), replacement);
  expect(within(form).getByText('solucion.pdf')).toBeTruthy();
  expect((title as HTMLInputElement).value).toBe('Guía resuelta');
  expect(within(form).getByText('.pdf')).toBeTruthy();
  await user.click(within(form).getByRole('button', { name: 'Mantener actual' }));
  expect(within(form).queryByText('solucion.pdf')).toBeNull();
  expect(within(form).getByText('.docx')).toBeTruthy();
  fireEvent.drop(within(form).getByText('Arrastra o selecciona un archivo'), {
    dataTransfer: { files: { item: () => replacement } },
  });
  await user.click(save);
  expect(perform).toHaveBeenCalledWith({
    kind: 'update-resource',
    resourceId: file.id,
    resource: { url: file.url, title: 'Guía resuelta.pdf', type: 'FILE' },
    file: replacement,
  });
  await waitFor(() => expect(screen.queryByRole('form', { name: 'Editor de recurso' })).toBeNull());
});

test('Resource rows name their action and file category instead of a type caption', () => {
  const sheet = {
    ...resource,
    id: 'resource-2',
    title: 'Notas.xlsx',
    url: '/api/protected/resource-2/file',
    type: 'FILE' as const,
    fileContentType: null,
    fileSize: null,
  };
  renderEditor(withNode({ resources: [resource, sheet] }));
  const list = screen.getByRole('list', { name: 'Recursos del nodo' });
  const [linkRow, fileRow] = within(list).getAllByRole('listitem');
  expect(
    within(linkRow).getByRole('link', { name: `Abrir enlace ${resource.title}` }),
  ).toBeTruthy();
  expect(linkRow.innerHTML).toContain('lucide-link-2"');
  expect(within(fileRow).getByRole('link', { name: 'Descargar Notas.xlsx' })).toBeTruthy();
  expect(fileRow.innerHTML).toContain('lucide-file-spreadsheet"');
  expect(within(list).queryByText(/^(Archivo|Enlace)$/)).toBeNull();
});

test('a Link edit offers its address but never a file replacement', async () => {
  const user = userEvent.setup();
  const { perform } = renderEditor(withNode({ resources: [resource] }));
  await user.click(screen.getByRole('button', { name: `Editar recurso ${resource.title}` }));
  const form = screen.getByRole('form', { name: 'Editor de recurso' });
  expect(within(form).queryByLabelText('Reemplazar archivo')).toBeNull();
  const address = within(form).getByRole('textbox', { name: 'Enlace' });
  await user.clear(address);
  await user.type(address, 'nueva-guia');
  await user.click(within(form).getByRole('button', { name: 'Guardar enlace' }));
  expect(perform).not.toHaveBeenCalled();
  await user.clear(address);
  await user.type(address, 'https://example.test/nueva');
  await user.click(within(form).getByRole('button', { name: 'Guardar enlace' }));
  expect(perform).toHaveBeenCalledWith({
    kind: 'update-resource',
    resourceId: resource.id,
    resource: { title: resource.title, url: 'https://example.test/nueva', type: 'LINK' },
  });
});

type User = ReturnType<typeof userEvent.setup>;

function renderEditor(
  overrides: Partial<NodeEditorProps> = {},
  ref = createRef<NodeEditorHandle>(),
  strictMode = false,
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
    session: { node, nodeTypes, isVisibilityPending: false, blockedPrerequisites: 0 },
    perform,
    onIntent,
    ...overrides,
  };
  const ui = (current: NodeEditorProps, mode: 'visible' | 'hidden' = 'visible') => (
    <Activity mode={mode}>
      <SidebarProvider>
        <NodeEditorPanel isOpen panelWidth={360} onPanelWidthChange={vi.fn()}>
          <NodeEditor {...current} ref={ref} />
        </NodeEditorPanel>
      </SidebarProvider>
    </Activity>
  );
  const view = render(ui(props), { reactStrictMode: strictMode });
  const rerenderWith = (next: Partial<NodeEditorProps>) => view.rerender(ui({ ...props, ...next }));
  const setVisibility = (mode: 'visible' | 'hidden') => view.rerender(ui(props, mode));
  return { ...view, props, perform, onIntent, ref, rerenderWith, setVisibility };
}

function withNode(overrides: Partial<RoadmapNode>): Pick<NodeEditorProps, 'session'> {
  return {
    session: {
      node: { ...node, ...overrides } as RoadmapNode,
      nodeTypes,
      isVisibilityPending: false,
      blockedPrerequisites: 0,
    },
  };
}

function deferredPerform() {
  let resolveLatest!: (result: NodeEditorPerformResult) => void;
  const perform = vi.fn(
    () =>
      new Promise<NodeEditorPerformResult>((resolve) => {
        resolveLatest = resolve;
      }),
  );
  return { perform, resolve: (result: NodeEditorPerformResult) => resolveLatest(result) };
}

async function retitle(user: User, title: string) {
  await user.clear(screen.getByLabelText('Título'));
  await user.paste(title);
}

async function fillLink(user: User, title: string, url: string) {
  await user.click(screen.getByRole('tab', { name: 'Enlace' }));
  await user.click(screen.getByPlaceholderText('Ej. Guía de ejercicios'));
  await user.paste(title);
  await user.click(screen.getByLabelText('Enlace', { selector: 'input' }));
  await user.paste(url);
}

const saveButton = () =>
  screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;

test('renders the selected Node as one cohesive editing surface', () => {
  renderEditor();

  expect(screen.getByRole('heading', { name: node.title })).toBeTruthy();
  expect(screen.getByTestId('node-type-icon')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Acceso de estudiantes' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Recursos/ })).toBeTruthy();
});

test('orders the panel so a long description comes last, after every other section', () => {
  renderEditor();

  const sections = [
    screen.getByLabelText('Título'),
    screen.getByRole('combobox', { name: 'Tipo' }),
    screen.getByRole('heading', { name: /Recursos/ }),
    screen.getByRole('heading', { name: 'Acceso de estudiantes' }),
    screen.getByRole('heading', { name: 'Eliminar nodo' }),
    screen.getByLabelText(/Descripción o Contenido del nodo/),
  ];
  for (const [index, section] of sections.slice(1).entries())
    expect(
      sections[index].compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
});

test('labels the description as optional Markdown content that accepts a dropped .md file', () => {
  renderEditor();

  const description = screen.getByRole('textbox', {
    name: 'Descripción o Contenido del nodo opcional',
  });
  expect(screen.getByText('opcional').tagName).toBe('EM');
  expect(description.getAttribute('aria-describedby')).toBe('edit-node-description-help');
  expect(
    screen.getByText(
      'El texto es compatible con Markdown. Puedes arrastrar un archivo .md para reemplazarlo.',
    ).id,
  ).toBe('edit-node-description-help');
});

test('keeps saving and previewing in a footer pinned below the scrolling content', async () => {
  const user = userEvent.setup();
  const { perform } = renderEditor();

  const footer = screen.getByRole('form', { name: 'Guardar nodo' });
  expect(footer.className).toContain('sticky');
  expect(footer.className).toContain('bottom-0');
  expect(within(footer).getByRole('button', { name: 'Guardar cambios' })).toBe(saveButton());
  expect(within(footer).getByRole('button', { name: 'Previsualizar' })).toBeTruthy();
  expect(
    screen.getByLabelText(/Descripción o Contenido del nodo/).compareDocumentPosition(footer) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  await retitle(user, 'Título enviado con Enter');
  await user.keyboard('{Enter}');
  expect(perform).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'update-node',
      value: expect.objectContaining({ title: 'Título enviado con Enter' }),
    }),
  );
});

const unsavedNotice = (text: string) => (_: string, element: Element | null) =>
  element?.tagName === 'SPAN' && element.textContent === text;

test('names the unsaved fields and discards them back to the saved Node', async () => {
  const user = userEvent.setup();
  renderEditor();

  await retitle(user, 'Nuevo título');
  expect(screen.getByText(unsavedNotice('Sin guardar: título'))).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Descartar' }));
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(node.title);
  expect(screen.queryByText('Sin guardar:')).toBeNull();
  expect(saveButton().disabled).toBe(true);
});

test('explains an empty title instead of saving it', async () => {
  const user = userEvent.setup();
  const { perform } = renderEditor();

  await user.clear(screen.getByLabelText('Título'));
  await user.click(saveButton());
  const title = screen.getByLabelText('Título');
  expect(screen.getByText('Escribe un título para el nodo.')).toBeTruthy();
  expect(title.getAttribute('aria-invalid')).toBe('true');
  expect(title.matches(':focus')).toBe(true);
  expect(perform).not.toHaveBeenCalled();
});

test('rejects an incomplete link address in Spanish', async () => {
  const user = userEvent.setup();
  const { perform } = renderEditor();

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await fillLink(user, 'Apunte', 'ejemplo.cl');
  await user.click(screen.getByRole('button', { name: 'Agregar enlace' }));
  expect(
    screen.getByText('Ingresa un enlace completo, por ejemplo https://ejemplo.cl.'),
  ).toBeTruthy();
  expect(perform).not.toHaveBeenCalled();
});

function prerequisiteHint(_: string, element: Element | null) {
  return (
    element?.getAttribute('data-slot') === 'field-description' &&
    element.textContent ===
      'Si a esa hora algún prerrequisito sigue bloqueado, este nodo no será desbloqueado.'
  );
}

test.each([
  [1, 'Su prerrequisito bloqueado también se desbloqueará a esa hora.'],
  [3, 'Sus 3 prerrequisitos bloqueados también se desbloquearán a esa hora.'],
])(
  'tells that scheduling also unlocks %i blocked prerequisites at that time',
  (blockedPrerequisites, hint) => {
    const { session } = withNode({ isTeacherBlocked: true });
    renderEditor({ session: { ...session, blockedPrerequisites } });

    expect(screen.getByText(hint)).toBeTruthy();
    expect(screen.queryByText(prerequisiteHint)).toBeNull();
  },
);

test('schedules the unlock day and time of a teacher-blocked Node in Chilean time, and removes it', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-07T15:00:00.000Z') });
  try {
    const user = userEvent.setup();
    const { onIntent, unmount } = renderEditor();

    const schedule = screen.getByRole('button', { name: 'Programar' }) as HTMLButtonElement;
    expect(schedule.disabled).toBe(true);
    expect(
      within(screen.getByText(prerequisiteHint)).getByText('no', { selector: 'strong' }),
    ).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Día del desbloqueo' }));
    expect(screen.getByText('Noviembre 2026')).toBeTruthy();
    const pastDay = screen.getByRole('button', { name: /, 6 de noviembre de 2026/ });
    expect((pastDay as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: /21 de noviembre de 2026/ }));
    await user.click(screen.getByRole('combobox', { name: 'Hora del desbloqueo' }));
    await user.click(await screen.findByRole('option', { name: '14:30' }));
    await user.click(schedule);
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'schedule-teacher-unlock',
      nodeId: node.id,
      unlockAt: '2026-11-21T17:30:00.000Z',
    });
    unmount();

    const view = renderEditor(
      withNode({ isTeacherBlocked: true, teacherUnlockAt: '2026-11-21T17:30:00.000Z' }),
    );
    expect(
      (await screen.findByRole('button', { name: 'Día del desbloqueo: Sábado, 21 de Noviembre' }))
        .textContent,
    ).toBe('Sábado, 21 de Noviembre');
    expect(
      within(screen.getByRole('combobox', { name: 'Hora del desbloqueo' })).getByText('14:30'),
    ).toBeTruthy();
    expect(screen.queryByText(/Chile/)).toBeNull();
    expect(screen.getByText(prerequisiteHint)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Quitar programación' }));
    expect(view.onIntent).toHaveBeenCalledWith({
      kind: 'schedule-teacher-unlock',
      nodeId: node.id,
      unlockAt: null,
    });
  } finally {
    vi.useRealTimers();
  }
});

test('defaults the unlock time to 23:59, listed right after 23:45', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-07T15:00:00.000Z') });
  try {
    const user = userEvent.setup();
    const { onIntent } = renderEditor();

    await user.click(await screen.findByRole('button', { name: 'Día del desbloqueo' }));
    await user.click(screen.getByRole('button', { name: /21 de noviembre de 2026/ }));
    const time = screen.getByRole('combobox', { name: 'Hora del desbloqueo' });
    expect(within(time).getByText('23:59')).toBeTruthy();
    await user.click(time);
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(options.slice(-2)).toEqual(['23:45', '23:59']);
    await user.click(screen.getByRole('option', { name: '23:59' }));
    await user.click(screen.getByRole('button', { name: 'Programar' }));
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'schedule-teacher-unlock',
      nodeId: node.id,
      unlockAt: '2026-11-22T02:59:00.000Z',
    });
  } finally {
    vi.useRealTimers();
  }
});

test('keeps 23:59 available on the current Chilean day after 23:45 has passed', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-08T02:50:00.000Z') });
  try {
    const user = userEvent.setup();
    const { onIntent } = renderEditor();

    await user.click(await screen.findByRole('button', { name: 'Día del desbloqueo' }));
    await user.click(screen.getByRole('button', { name: /, 7 de noviembre de 2026/ }));
    expect(
      within(screen.getByRole('combobox', { name: 'Hora del desbloqueo' })).getByText('23:59'),
    ).toBeTruthy();
    await user.click(screen.getByRole('combobox', { name: 'Hora del desbloqueo' }));
    expect(
      (await screen.findByRole('option', { name: '23:45' })).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(screen.getByRole('option', { name: '23:59' }).getAttribute('aria-disabled')).not.toBe(
      'true',
    );
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Programar' }));
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'schedule-teacher-unlock',
      nodeId: node.id,
      unlockAt: '2026-11-08T02:59:00.000Z',
    });
  } finally {
    vi.useRealTimers();
  }
});

test('offers only future times on the current Chilean day', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-07T15:00:00.000Z') });
  try {
    const user = userEvent.setup();
    renderEditor();

    await user.click(await screen.findByRole('button', { name: 'Día del desbloqueo' }));
    await user.click(screen.getByRole('button', { name: /, 7 de noviembre de 2026/ }));
    await user.click(screen.getByRole('combobox', { name: 'Hora del desbloqueo' }));

    expect(
      (await screen.findByRole('option', { name: '12:00' })).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(screen.getByRole('option', { name: '12:15' }).getAttribute('aria-disabled')).not.toBe(
      'true',
    );
  } finally {
    vi.useRealTimers();
  }
});

test.each([
  { isVisible: true, label: 'Ocultar', command: 'hide-node' },
  { isVisible: false, label: 'Mostrar', command: 'show-node' },
])('asks to $label a Node with the $command command', async ({ isVisible, label, command }) => {
  const user = userEvent.setup();
  const { onIntent } = renderEditor(withNode({ isVisible }));

  await user.click(screen.getByRole('button', { name: label }));
  expect(onIntent).toHaveBeenCalledWith({ kind: command, nodeId: node.id });
});

test('offers no unlock schedule while a Node has no teacher block', () => {
  renderEditor(withNode({ isTeacherBlocked: false }));

  expect(screen.queryByLabelText('Desbloqueo programado')).toBeNull();
});

test('saves Node information through one perform effect and preserves rejected input', async () => {
  const user = userEvent.setup();
  const view = renderEditor();
  const { perform } = view;
  const title = screen.getByLabelText('Título');

  expect(saveButton().disabled).toBe(true);
  await user.clear(title);
  await user.type(title, 'Límites y continuidad');
  await user.click(saveButton());

  expect(perform).toHaveBeenCalledWith({
    kind: 'update-node',
    nodeId: node.id,
    value: {
      title: 'Límites y continuidad',
      description: node.description,
      nodeTypeId: node.nodeTypeId,
    },
  });
  await waitFor(() => expect(saveButton().disabled).toBe(true));

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

test('fullscreen edits the shared Node draft, retains it on close, and saves it', async () => {
  const user = userEvent.setup();
  const { perform } = renderEditor();
  const description = '# Objetivo\n\n**Practicar límites**';

  await user.click(screen.getByRole('button', { name: 'Editar nodo en pantalla completa' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Editar nodo' }));
  expect(dialog.queryByRole('button', { name: /Previsualizar/ })).toBeNull();
  await user.clear(dialog.getByLabelText('Título'));
  await user.type(dialog.getByLabelText('Título'), 'Límites y continuidad');
  fireEvent.change(dialog.getByLabelText(/Descripción/), { target: { value: description } });
  await user.keyboard('{Escape}');

  expect(perform).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Límites y continuidad');
  expect((screen.getByLabelText(/Descripción/) as HTMLTextAreaElement).value).toBe(description);

  await user.click(screen.getByRole('button', { name: 'Editar nodo en pantalla completa' }));
  const reopened = within(screen.getByRole('dialog', { name: 'Editar nodo' }));
  expect((reopened.getByLabelText(/Descripción/) as HTMLTextAreaElement).value).toBe(description);
  await user.click(reopened.getByRole('button', { name: 'Guardar cambios' }));

  expect(perform).toHaveBeenCalledWith({
    kind: 'update-node',
    nodeId: node.id,
    value: { title: 'Límites y continuidad', description, nodeTypeId: node.nodeTypeId },
  });
});

test('normalizes a thrown Node save failure and keeps the retryable draft', async () => {
  const user = userEvent.setup();
  const perform = vi.fn().mockRejectedValue(new Error('network failure'));
  renderEditor({ perform });

  await retitle(user, 'Borrador recuperable');
  await user.click(saveButton());

  await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador recuperable');
  expect(saveButton().disabled).toBe(false);
});

test('keeps an empty Resource composer clean and uses the finite link session for additions', async () => {
  const user = userEvent.setup();
  const { perform } = renderEditor();

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  expect(screen.getByRole('button', { name: 'Previsualizar' })).toBeTruthy();
  await fillLink(user, 'Guía nueva', 'https://example.test/nueva');
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

  await retitle(user, 'Borrador');

  await expect(ref.current!.guardDraft({ kind: 'open-resource', nodeId: node.id })).resolves.toBe(
    true,
  );
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('proceeds immediately for a clean outside transition', async () => {
  const ref = createRef<NodeEditorHandle>();
  renderEditor({}, ref);

  await expect(ref.current!.guardDraft({ kind: 'enter-canvas-preview' })).resolves.toBe(true);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('uploads a selected file and keeps the resource session on rejection', async () => {
  const user = userEvent.setup();
  const perform = vi.fn().mockResolvedValue({ status: 'rejected' } as const);
  renderEditor({ perform });

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  const file = new File(['guía'], 'guia-1.pdf', { type: 'application/pdf' });
  await user.upload(screen.getByLabelText('Archivo', { selector: 'input' }), file);
  await user.click(screen.getByRole('button', { name: 'Subir archivo' }));

  expect(perform).toHaveBeenCalledWith({ kind: 'upload-resource', nodeId: node.id, file });
  await screen.findByText('guia-1.pdf');
});

test('does not let a late Resource result clear a newer Resource session', async () => {
  const user = userEvent.setup();
  const { perform, resolve: resolvePerform } = deferredPerform();
  renderEditor({ perform });

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await fillLink(user, 'Primera versión', 'https://example.test/primera');
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
  const { perform, resolve: resolvePerform } = deferredPerform();
  renderEditor({ perform });

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await fillLink(user, 'Guía temporal', 'https://example.test/temporal');
  await user.click(screen.getByRole('button', { name: 'Agregar enlace' }));
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));

  await user.click(screen.getByRole('button', { name: 'Cerrar editor de recurso' }));
  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await fillLink(user, 'Guía temporal', 'https://example.test/temporal');

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
  renderEditor({
    ...withNode({ resources: [resource] }),
    perform,
  });

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
  const dialog = screen.getByRole('alertdialog', { name: '¿Eliminar Guía de ejercicios?' });
  await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('alertdialog', { name: '¿Eliminar Guía de ejercicios?' })).toBeTruthy();
  await user.click(
    within(screen.getByRole('alertdialog', { name: '¿Eliminar Guía de ejercicios?' })).getByRole(
      'button',
      {
        name: 'Eliminar',
      },
    ),
  );
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('guards a dirty transition and resets only after confirmed discard', async () => {
  const user = userEvent.setup();
  const ref = createRef<NodeEditorHandle>();
  renderEditor({}, ref);
  await retitle(user, 'Borrador');

  const decision = ref.current!.guardDraft({ kind: 'deselect-node', nodeId: node.id });
  await screen.findByRole('alertdialog', { name: '¿Descartar los cambios sin guardar?' });
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  await expect(decision).resolves.toBe(false);
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador');

  const confirmed = ref.current!.guardDraft({ kind: 'deselect-node', nodeId: node.id });
  await screen.findByRole('alertdialog', { name: '¿Descartar los cambios sin guardar?' });
  await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));
  await expect(confirmed).resolves.toBe(true);
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(node.title);
});

test('keeps the complete Node and Resource session unchanged when a guard is cancelled', async () => {
  const user = userEvent.setup();
  const ref = createRef<NodeEditorHandle>();
  renderEditor({}, ref);

  await retitle(user, 'Borrador del nodo');
  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await fillLink(user, 'Borrador del recurso', 'https://example.test/borrador');

  const decision = ref.current!.guardDraft({ kind: 'deselect-node', nodeId: node.id });
  await screen.findByRole('alertdialog', { name: '¿Descartar los cambios sin guardar?' });
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));

  await expect(decision).resolves.toBe(false);
  expect(
    (screen.getByLabelText('Título', { selector: '#edit-node-title' }) as HTMLInputElement).value,
  ).toBe('Borrador del nodo');
  expect(screen.getByText('Nuevo recurso')).toBeTruthy();
  expect((screen.getByPlaceholderText('Ej. Guía de ejercicios') as HTMLInputElement).value).toBe(
    'Borrador del recurso',
  );
  expect((screen.getByLabelText('Enlace', { selector: 'input' }) as HTMLInputElement).value).toBe(
    'https://example.test/borrador',
  );
});

test('resets the complete editing session before a guarded caller resumes', async () => {
  const user = userEvent.setup();
  const ref = createRef<NodeEditorHandle>();
  const { onIntent } = renderEditor({}, ref);

  await retitle(user, 'Borrador del nodo');
  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await user.click(screen.getByRole('tab', { name: 'Enlace' }));
  await user.type(screen.getByPlaceholderText('Ej. Guía de ejercicios'), 'Borrador del recurso');

  const resumed = ref
    .current!.guardDraft({ kind: 'deselect-node', nodeId: node.id })
    .then((proceed) => {
      if (!proceed) return;
      expect(
        (screen.getByLabelText('Título', { selector: '#edit-node-title' }) as HTMLInputElement)
          .value,
      ).toBe(node.title);
      expect(screen.queryByText('Nuevo recurso')).toBeNull();
      onIntent({ kind: 'close', nodeId: node.id });
    });
  await screen.findByRole('alertdialog', { name: '¿Descartar los cambios sin guardar?' });
  await user.click(screen.getByRole('button', { name: 'Descartar y continuar' }));

  await resumed;
  expect(onIntent).toHaveBeenCalledWith({ kind: 'close', nodeId: node.id });
});

test('leaves the draft question of a Node deletion to the canvas, which asks it once', async () => {
  const user = userEvent.setup();
  const ref = createRef<NodeEditorHandle>();
  const { onIntent } = renderEditor(withNode({ resources: [resource] }), ref);

  await retitle(user, 'Borrador');
  await user.click(screen.getByRole('button', { name: 'Eliminar' }));

  expect(onIntent).toHaveBeenCalledWith({ kind: 'delete-node', nodeId: node.id });
  expect(
    screen.queryByRole('alertdialog', { name: '¿Descartar los cambios sin guardar?' }),
  ).toBeNull();
  const decision = ref.current!.guardDraft({ kind: 'delete-node', nodeId: node.id });
  await user.click(await screen.findByRole('button', { name: 'Descartar y continuar' }));
  await expect(decision).resolves.toBe(true);
});

test('projects the current draft through a preview intent and carries an opaque focus callback', async () => {
  const user = userEvent.setup();
  const { onIntent } = renderEditor();
  await retitle(user, 'Límites y continuidad');
  await user.click(screen.getByRole('button', { name: 'Previsualizar cambios' }));

  const intent = onIntent.mock.calls.at(-1)?.[0];
  expect(intent).toMatchObject({
    kind: 'preview-node-information',
    node: { title: 'Límites y continuidad', isVisible: true, access: { status: 'ACCESSIBLE' } },
    returnFocus: expect.any(Function),
  });
});

test('projects an unsaved Node type through the public preview intent', async () => {
  const user = userEvent.setup();
  const { onIntent } = renderEditor();

  await user.click(screen.getByRole('combobox', { name: 'Tipo' }));
  await user.click(await screen.findByRole('option', { name: 'Evaluación' }));
  await user.click(screen.getByRole('button', { name: 'Previsualizar cambios' }));

  expect(onIntent.mock.calls.at(-1)?.[0]).toMatchObject({
    kind: 'preview-node-information',
    node: { nodeTypeId: 'assessment' },
  });
});

test('projects unsaved Resource sessions through the public preview intent', async () => {
  const user = userEvent.setup();
  const { onIntent } = renderEditor(withNode({ resources: [resource] }));

  await user.click(screen.getByRole('button', { name: 'Editar recurso Guía de ejercicios' }));
  await user.clear(screen.getByPlaceholderText('Ej. Guía de ejercicios'));
  await user.type(screen.getByPlaceholderText('Ej. Guía de ejercicios'), 'Guía actualizada');
  await user.click(screen.getByRole('button', { name: 'Previsualizar cambios' }));

  expect(onIntent.mock.calls.at(-1)?.[0]).toMatchObject({
    kind: 'preview-node-information',
    node: {
      isVisible: true,
      access: { status: 'ACCESSIBLE' },
      isCompleted: false,
      canComplete: true,
      resources: [{ id: resource.id, title: 'Guía actualizada', url: resource.url, type: 'LINK' }],
    },
  });
});

test.each([
  {
    name: 'includes a pending link Resource in the public preview intent',
    compose: (user: User) => fillLink(user, 'Guía nueva', 'https://example.test/nueva'),
    preview: {
      id: 'node-information-preview-resource',
      title: 'Guía nueva',
      url: 'https://example.test/nueva',
      type: 'LINK',
    },
  },
  {
    name: 'includes a selected file Resource in the public preview intent',
    compose: (user: User) =>
      user.upload(
        screen.getByLabelText('Archivo', { selector: 'input' }),
        new File(['guía'], 'guia-de-limites.pdf', { type: 'application/pdf' }),
      ),
    preview: {
      id: 'node-information-preview-file',
      title: 'guia-de-limites.pdf',
      url: '#',
      type: 'FILE',
    },
  },
])('$name', async ({ compose, preview }) => {
  const user = userEvent.setup();
  const { onIntent } = renderEditor();

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await compose(user);
  await user.click(screen.getByRole('button', { name: 'Previsualizar cambios' }));

  expect(onIntent.mock.calls.at(-1)?.[0]).toMatchObject({
    kind: 'preview-node-information',
    node: { resources: [preview] },
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

  const file = await screen.findByLabelText('Archivo', { selector: 'input' });
  await waitFor(() => expect(file.matches(':focus')).toBe(true));
  expect(screen.getAllByText('Nuevo recurso')).toHaveLength(1);
});

test('waits for a typed Resource command target before consuming it', async () => {
  const targetNode = { ...node, id: 'node-2', title: 'Derivadas' };
  const command = {
    id: 'command-for-node-2',
    kind: 'open-resource' as const,
    nodeId: targetNode.id,
    mode: 'link' as const,
  };
  const { rerenderWith } = renderEditor({ command });

  expect(screen.queryByText('Nuevo recurso')).toBeNull();
  rerenderWith(withNode(targetNode));

  const composer = await screen.findByRole('form', { name: 'Editor de recurso' });
  const title = within(composer).getByLabelText('Título');
  await waitFor(() => expect(title.matches(':focus')).toBe(true));
});

test('does not reopen or reset a Resource session when the same command is redelivered', async () => {
  const user = userEvent.setup();
  const command = {
    id: 'command-1',
    kind: 'open-resource' as const,
    nodeId: node.id,
    mode: 'link' as const,
  };
  const { rerenderWith } = renderEditor({ command });
  const composer = await screen.findByRole('form', { name: 'Editor de recurso' });
  const title = within(composer).getByLabelText('Título');
  await user.type(title, 'Apuntes');

  rerenderWith({ command: { ...command } });

  const redeliveredComposer = screen.getByRole('form', { name: 'Editor de recurso' });
  expect((within(redeliveredComposer).getByLabelText('Título') as HTMLInputElement).value).toBe(
    'Apuntes',
  );
  expect(screen.getAllByText('Nuevo recurso')).toHaveLength(1);
});

test('preserves a dirty draft while a same-Node canonical refresh updates its baseline', async () => {
  const user = userEvent.setup();
  const { rerenderWith } = renderEditor();
  await retitle(user, 'Borrador');
  rerenderWith(withNode({ title: 'Cambio autorizado externamente' }));
  await waitFor(() =>
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador'),
  );
  expect(screen.getByRole('button', { name: 'Previsualizar cambios' })).toBeTruthy();
});

test('does not let a late Node result replace a refreshed same-Node baseline', async () => {
  const user = userEvent.setup();
  const { perform, resolve: resolvePerform } = deferredPerform();
  const { rerenderWith } = renderEditor({ perform });

  await retitle(user, 'Borrador local');
  await user.click(saveButton());
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));

  rerenderWith(withNode({ title: 'Cambio autorizado externamente' }));
  await screen.findByRole('heading', { name: 'Cambio autorizado externamente' });

  resolvePerform({ status: 'committed' });
  await screen.findByRole('button', { name: 'Previsualizar cambios' });
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador local');
});

test('a remote title edit during a pending save still requires explicit draft resolution', async () => {
  const user = userEvent.setup();
  const perform = vi.fn(() => new Promise<NodeEditorPerformResult>(() => undefined));
  const view = renderEditor({ perform });
  await retitle(user, 'Borrador en vuelo');
  await user.click(saveButton());
  view.rerenderWith(withNode({ title: 'Edición remota incompatible' }));
  expect(await screen.findByRole('status')).toHaveProperty(
    'textContent',
    expect.stringContaining('cambió mientras editabas'),
  );
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador en vuelo');
  expect(saveButton().disabled).toBe(true);
  expect(perform).toHaveBeenCalledOnce();
});

test('a confirmed save arriving after a second local edit does not become a remote conflict', async () => {
  const user = userEvent.setup();
  const { perform, resolve: resolveSave } = deferredPerform();
  const view = renderEditor({ perform });
  await retitle(user, 'Primera edición');
  await user.click(saveButton());
  await retitle(user, 'Segunda edición');
  resolveSave({ status: 'committed' });
  await waitFor(() => expect(saveButton().disabled).toBe(false));
  view.rerenderWith(withNode({ title: 'Primera edición' }));
  await waitFor(() => expect(saveButton().disabled).toBe(false));
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Segunda edición');
  expect(screen.queryByText(/cambió mientras editabas/)).toBeNull();
});

test('saves consecutive Node edits, links and a file in the same mounted editor', async () => {
  const user = userEvent.setup();
  const { perform } = renderEditor({}, undefined, true);

  for (const title of ['Primera edición', 'Segunda edición']) {
    await retitle(user, title);
    expect(saveButton().disabled).toBe(false);
    await user.click(saveButton());
    await waitFor(() => expect(saveButton().disabled).toBe(true));
  }
  expect(perform).toHaveBeenCalledTimes(2);

  for (const title of ['Primer enlace', 'Segundo enlace']) {
    await user.click(screen.getByRole('button', { name: 'Recurso' }));
    await fillLink(user, title, 'https://example.test/material');
    await user.click(screen.getByRole('button', { name: 'Agregar enlace' }));
    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'Editor de recurso' })).toBeNull(),
    );
    expect(perform).toHaveBeenLastCalledWith({
      kind: 'add-resource',
      nodeId: node.id,
      resource: { title, url: 'https://example.test/material', type: 'LINK' },
    });
  }

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  const file = new File(['guía'], 'guia.pdf', { type: 'application/pdf' });
  await user.upload(screen.getByLabelText('Archivo', { selector: 'input' }), file);
  await user.click(screen.getByRole('button', { name: 'Subir archivo' }));
  await waitFor(() => expect(screen.queryByRole('form', { name: 'Editor de recurso' })).toBeNull());
  expect(perform).toHaveBeenLastCalledWith({ kind: 'upload-resource', nodeId: node.id, file });

  await retitle(user, 'Edición después de publicar');
  expect(saveButton().disabled).toBe(false);
  await user.click(saveButton());
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(6));
});

test.each(['committed', 'rejected'] as const)(
  'settles a %s Node save while Effects are disconnected and preserves newer input',
  async (status) => {
    const user = userEvent.setup();
    const { perform, resolve } = deferredPerform();
    const { setVisibility } = renderEditor({ perform }, undefined, true);
    await retitle(user, 'Primer cambio');
    await user.click(saveButton());
    await waitFor(() => expect(perform).toHaveBeenCalledOnce());
    await retitle(user, 'Cambio más reciente');
    setVisibility('hidden');
    await act(async () => resolve({ status }));
    setVisibility('visible');
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Cambio más reciente');
    await user.click(saveButton());
    await waitFor(() => expect(perform).toHaveBeenCalledTimes(2));
    await act(async () => resolve({ status: 'rejected' }));
  },
);

test('ignores a late save after replacing the selected Node', async () => {
  const user = userEvent.setup();
  const { perform, resolve } = deferredPerform();
  const view = renderEditor({ perform }, undefined, true);
  await retitle(user, 'Guardado del primer nodo');
  await user.click(saveButton());
  await waitFor(() => expect(perform).toHaveBeenCalledOnce());
  view.rerenderWith(withNode({ id: 'node-2', title: 'Otro nodo' }));
  await act(async () => resolve({ status: 'committed' }));
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Otro nodo');
  await retitle(user, 'Edición del segundo nodo');
  expect(saveButton().disabled).toBe(false);
});

test('a save from an unmounted editor cannot modify a new editor instance', async () => {
  const user = userEvent.setup();
  const { perform, resolve } = deferredPerform();
  const view = renderEditor({ perform }, undefined, true);
  await retitle(user, 'Guardado de la instancia anterior');
  await user.click(saveButton());
  await waitFor(() => expect(perform).toHaveBeenCalledOnce());
  view.unmount();
  renderEditor(withNode({ id: 'node-2', title: 'Nueva instancia' }), undefined, true);
  await retitle(user, 'Borrador de la nueva instancia');
  await act(async () => resolve({ status: 'committed' }));
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(
    'Borrador de la nueva instancia',
  );
  expect(saveButton().disabled).toBe(false);
});

test('retries a thrown save failure in Strict Mode without leaving the editor pending', async () => {
  const user = userEvent.setup();
  const perform = vi
    .fn()
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValue({ status: 'committed' });
  renderEditor({ perform }, undefined, true);
  await retitle(user, 'Borrador recuperable');
  await user.click(saveButton());
  await waitFor(() => expect(saveButton().disabled).toBe(false));
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador recuperable');
  await user.click(saveButton());
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(saveButton().disabled).toBe(true));
});
