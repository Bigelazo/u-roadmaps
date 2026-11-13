import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import type { ComponentProps } from 'react';
import type { RoadmapDto } from '@/features/roadmap/types';

const nodeTypes: RoadmapDto['nodeTypes'] = [
  { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
];

async function openCreator(onSubmit: ComponentProps<typeof NodeCreator>['onSubmit']) {
  const user = userEvent.setup();
  render(
    <NodeCreator
      nodeTypes={nodeTypes}
      onSubmit={onSubmit}
      onCreateNodeType={async () => false}
      onUpdateNodeType={async () => false}
      onRequestDeleteNodeType={() => undefined}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Crear en el mapa' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Crear nodo' }));
  const dialog = await screen.findByRole('dialog', { name: 'Crear nodo' });
  return { user, dialog };
}

test('opens the roadmap creation menu without a Base UI runtime error', async () => {
  const user = userEvent.setup();

  render(
    <NodeCreator
      nodeTypes={[]}
      onSubmit={async () => false}
      onCreateNodeType={async () => false}
      onUpdateNodeType={async () => false}
      onRequestDeleteNodeType={() => undefined}
    />,
  );

  const trigger = screen.getByRole('button', { name: 'Crear en el mapa' });
  await user.click(trigger);

  const createItem = await screen.findByRole('menuitem', { name: 'Crear nodo' });
  const manageTypesItem = await screen.findByRole('menuitem', {
    name: 'Gestionar tipos de nodo',
  });
  expect(trigger.parentElement?.contains(createItem)).toBe(true);
  expect(trigger.parentElement?.contains(manageTypesItem)).toBe(true);
});

test('explains a missing title inline, focuses it and does not submit', async () => {
  const onSubmit = vi.fn(async () => true);
  const { user } = await openCreator(onSubmit);

  await user.click(screen.getByRole('button', { name: 'Crear nodo' }));

  const title = screen.getByRole('textbox', { name: 'Título' });
  expect(onSubmit).not.toHaveBeenCalled();
  expect(title.matches(':focus')).toBe(true);
  expect(title.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Escribe un título para el nodo.').id).toBe(
    title.getAttribute('aria-describedby'),
  );

  await user.type(title, 'Límites');
  expect(screen.queryByText('Escribe un título para el nodo.')).toBeNull();
});

test('shows the creation in progress and blocks a second submission', async () => {
  let finish: (created: boolean) => void = () => undefined;
  const onSubmit = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const { user, dialog } = await openCreator(onSubmit);

  await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Límites');
  await user.click(screen.getByRole('button', { name: 'Crear nodo' }));

  const pending = await screen.findByRole('button', { name: 'Creando…' });
  expect((pending as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  await user.type(screen.getByRole('textbox', { name: 'Título' }), '{Enter}');
  expect(onSubmit).toHaveBeenCalledTimes(1);

  finish(true);
  await vi.waitFor(() => expect(dialog.isConnected).toBe(false));
});

test('keeps the draft and explains a failed creation inside the dialog', async () => {
  const onSubmit = vi.fn(async () => false);
  const { user } = await openCreator(onSubmit);

  await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Límites');
  await user.type(screen.getByRole('textbox', { name: 'Contenido (opcional)' }), 'Repaso');
  await user.click(screen.getByRole('button', { name: 'Crear nodo' }));

  expect((await screen.findByRole('alert')).textContent).toBe(
    'No se pudo crear el nodo. Tu borrador se mantiene; intenta de nuevo.',
  );
  expect(screen.getByRole('dialog', { name: 'Crear nodo' })).toBeTruthy();
  expect((screen.getByRole('textbox', { name: 'Título' }) as HTMLTextAreaElement).value).toBe(
    'Límites',
  );
  expect(
    (screen.getByRole('textbox', { name: 'Contenido (opcional)' }) as HTMLTextAreaElement).value,
  ).toBe('Repaso');
  expect((screen.getByRole('button', { name: 'Crear nodo' }) as HTMLButtonElement).disabled).toBe(
    false,
  );
});

async function stageLink(user: ReturnType<typeof userEvent.setup>, title: string, url: string) {
  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await user.click(screen.getByRole('tab', { name: 'Enlace' }));
  const composer = screen.getByRole('form', { name: 'Editor de recurso' });
  await user.type(within(composer).getByRole('textbox', { name: 'Título' }), title);
  await user.type(within(composer).getByRole('textbox', { name: 'Enlace' }), url);
  await user.click(within(composer).getByRole('button', { name: 'Agregar enlace' }));
}

test('stages links locally and hands them over with the node', async () => {
  const onSubmit = vi.fn(async () => true);
  const { user } = await openCreator(onSubmit);

  await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Límites');
  await stageLink(user, 'Clase grabada', 'https://video.example/clase');
  await stageLink(user, 'Apunte', 'https://apunte.example/limites');
  expect(screen.getByRole('heading', { name: 'Recursos (2)' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Quitar recurso Apunte' }));
  await user.click(screen.getByRole('button', { name: 'Crear nodo' }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Límites' }),
    [
      expect.objectContaining({
        type: 'LINK',
        title: 'Clase grabada',
        url: 'https://video.example/clase',
      }),
    ],
    expect.any(Function),
  );
});

test('does not create the node while a resource is half prepared', async () => {
  const onSubmit = vi.fn(async () => true);
  const { user } = await openCreator(onSubmit);

  await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Límites');
  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  await user.click(screen.getByRole('tab', { name: 'Enlace' }));
  const composer = screen.getByRole('form', { name: 'Editor de recurso' });
  await user.type(within(composer).getByRole('textbox', { name: 'Título' }), 'Clase');
  await user.click(screen.getByRole('button', { name: 'Crear nodo' }));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toBe(
    'Agrega o descarta el recurso que estás preparando antes de crear el nodo.',
  );
});

test('rejects a file above 25 MB before the node exists', async () => {
  const { user } = await openCreator(vi.fn(async () => true));

  await user.click(screen.getByRole('button', { name: 'Recurso' }));
  const tooLarge = new File(['x'], 'video.mp4', { type: 'video/mp4' });
  Object.defineProperty(tooLarge, 'size', { value: 25 * 1024 * 1024 + 1 });
  await user.upload(screen.getByLabelText('Archivo', { selector: 'input' }), tooLarge);

  expect(screen.getByText('El archivo supera los 25 MB.')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Agregar archivo' }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

test('shows which staged resource is uploading', async () => {
  let report: (progress: { current: number; total: number }) => void = () => undefined;
  const onSubmit = vi.fn(
    (
      _node: unknown,
      _resources: unknown,
      onProgress: (progress: { current: number; total: number }) => void,
    ) =>
      new Promise<boolean>(() => {
        report = onProgress;
      }),
  );
  const { user } = await openCreator(onSubmit);

  await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Límites');
  await stageLink(user, 'Clase grabada', 'https://video.example/clase');
  await user.click(screen.getByRole('button', { name: 'Crear nodo' }));
  expect(await screen.findByRole('button', { name: 'Creando…' })).toBeTruthy();
  act(() => report({ current: 1, total: 1 }));

  expect(await screen.findByRole('button', { name: 'Subiendo recursos 1 de 1…' })).toBeTruthy();
});

test('chooses student access with a segmented control that explains each option', async () => {
  const onSubmit = vi.fn(async () => true);
  const { user } = await openCreator(onSubmit);
  const access = screen.getByRole('radiogroup', { name: 'Acceso de estudiantes' });

  expect(within(access).getByRole('radio', { name: 'Visible' }).getAttribute('aria-checked')).toBe(
    'true',
  );
  expect(screen.getByText('Aparecerá en la ruta de los estudiantes.')).toBeTruthy();

  await user.click(within(access).getByRole('radio', { name: 'Oculto' }));
  expect(screen.getByText('Solo el equipo docente lo verá hasta que lo muestres.')).toBeTruthy();
  await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Borrador docente');
  await user.click(screen.getByRole('button', { name: 'Crear nodo' }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Borrador docente', isVisible: false }),
    [],
    expect.any(Function),
  );
});
