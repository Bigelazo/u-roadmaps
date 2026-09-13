import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { roadmapActions, renderCanvas, useRoadmapMock } from './test-harness';

test('previews and confirms the node visibility action before changing it', async () => {
  const user = userEvent.setup();
  const toggleVisibility = vi.fn();
  const previewNodeVisibility = vi
    .fn()
    .mockResolvedValue([{ id: 'dependency-1', sourceNodeId: 'node-1', targetNodeId: 'node-2' }]);
  useRoadmapMock.mockReturnValue(roadmapActions({ toggleVisibility, previewNodeVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar ocultación' });
  expect(dialog.getAttribute('data-intent')).toBe('destructive');
  expect(within(dialog).getByRole('listitem', { name: 'Límites' })).toBeTruthy();
  expect(dialog.textContent).toContain('1 dependencia');
  expect(dialog.textContent).toContain('Límites');
  expect(dialog.textContent).toContain('node-2');
  expect(
    within(dialog).getByRole('heading', { name: 'Dependencias que se eliminarán' }),
  ).toBeTruthy();
  expect(
    within(within(dialog).getByRole('list', { name: 'Dependencias que se eliminarán' })).getByRole(
      'listitem',
      { name: 'Relación: Límites → node-2' },
    ),
  ).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(toggleVisibility).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
  const confirmation = await screen.findByRole('alertdialog', { name: 'Confirmar ocultación' });
  await user.click(within(confirmation).getByRole('button', { name: 'Ocultar' }));
  expect(toggleVisibility).toHaveBeenCalledWith('node-1', true);
});

test('shows an explicit empty dependency state when hiding a node without dependencies', async () => {
  const user = userEvent.setup();
  const toggleVisibility = vi.fn();
  const previewNodeVisibility = vi.fn().mockResolvedValue([]);
  useRoadmapMock.mockReturnValue(roadmapActions({ toggleVisibility, previewNodeVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Ocultar para estudiantes' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar ocultación' });

  expect(dialog.textContent).toContain('desaparecerá del Roadmap del estudiantado');
  expect(dialog.textContent).toContain('se quitará su Bloqueo docente');
  expect(dialog.textContent).toContain('no posee Dependencias');
  const dependencies = within(dialog).getByRole('region', {
    name: 'Dependencias que se eliminarán',
  });
  expect(within(dependencies).getByText('No hay Dependencias relacionadas.')).toBeTruthy();

  await user.click(within(dialog).getByRole('button', { name: 'Ocultar' }));
  expect(toggleVisibility).toHaveBeenCalledWith('node-1', true);
});

test('confirms showing a node with the approved message before changing it', async () => {
  const user = userEvent.setup();
  const toggleVisibility = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ toggleVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar mostrar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar publicación' });
  expect(dialog.getAttribute('data-intent')).toBe('default');
  const approvedMessage =
    'Este Nodo se mostrará al estudiantado y quedará disponible inmediatamente. No tendrá Dependencias ni Bloqueo docente.';
  expect(within(dialog).getByText(approvedMessage).textContent).toBe(approvedMessage);
  expect(
    within(within(dialog).getByRole('region', { name: 'Nodo que se publicará' })).getByRole(
      'listitem',
      { name: 'Límites' },
    ),
  ).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Mostrar' }));
  expect(toggleVisibility).toHaveBeenCalledWith('node-1', false);
});

test('prevents duplicate visibility previews while loading their impact', async () => {
  const user = userEvent.setup();
  let resolvePreview!: (dependencies: []) => void;
  const previewNodeVisibility = vi.fn(
    () =>
      new Promise<[]>((resolve) => {
        resolvePreview = resolve;
      }),
  );
  useRoadmapMock.mockReturnValue(roadmapActions({ previewNodeVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  const visibilityControl = screen.getByRole('button', {
    name: 'Ocultar para estudiantes',
  }) as HTMLButtonElement;
  await user.click(visibilityControl);

  await waitFor(() => expect(visibilityControl.disabled).toBe(true));
  await user.click(visibilityControl);
  expect(previewNodeVisibility).toHaveBeenCalledTimes(1);

  resolvePreview([]);
  expect(await screen.findByRole('alertdialog', { name: 'Confirmar ocultación' })).toBeTruthy();
});

test('keeps a failed visibility mutation recoverable and blocks duplicate confirmation', async () => {
  const user = userEvent.setup();
  let resolveFirstAttempt!: (changed: boolean) => void;
  const toggleVisibility = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveFirstAttempt = resolve;
        }),
    )
    .mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ toggleVisibility }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar mostrar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar publicación' });
  const confirm = within(dialog).getByRole('button', { name: 'Mostrar' }) as HTMLButtonElement;
  await user.click(within(dialog).getByRole('button', { name: 'Mostrar' }));
  await waitFor(() => expect(confirm.disabled).toBe(true));

  await user.click(confirm);
  expect(toggleVisibility).toHaveBeenCalledTimes(1);

  resolveFirstAttempt(false);
  await waitFor(() => expect(confirm.disabled).toBe(false));
  expect(screen.getByRole('alertdialog', { name: 'Confirmar publicación' })).toBeTruthy();

  await user.click(confirm);
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog', { name: 'Confirmar publicación' })).toBeNull(),
  );
  expect(toggleVisibility).toHaveBeenCalledTimes(2);
});
