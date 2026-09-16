import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { roadmapActions, renderCanvas, useRoadmapMock } from './test-harness';

test('confirms, cancels, and deletes every selected dependency', async () => {
  const user = userEvent.setup();
  const deleteDependency = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ deleteDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminación de dependencias' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Confirmar eliminación' });
  expect(dialog.getAttribute('data-intent')).toBe('destructive');
  expect(dialog.textContent).toContain(
    'Eliminarás estas dependencias. Esta acción no se puede deshacer.',
  );
  await user.keyboard('{Enter}');
  expect(deleteDependency).toHaveBeenCalledTimes(2);
  expect(deleteDependency).toHaveBeenNthCalledWith(1, 'dependency-1');
  expect(deleteDependency).toHaveBeenNthCalledWith(2, 'dependency-2');
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

  deleteDependency.mockClear();
  await user.click(screen.getByRole('button', { name: 'Solicitar eliminación de dependencias' }));

  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(deleteDependency).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminación de dependencias' }));
  await user.click(screen.getByRole('button', { name: 'Eliminar' }));
  expect(deleteDependency).toHaveBeenNthCalledWith(1, 'dependency-1');
  expect(deleteDependency).toHaveBeenNthCalledWith(2, 'dependency-2');
});

test('keeps failed dependency deletions recoverable and retries only the failed ones', async () => {
  const user = userEvent.setup();
  const deleteDependency = vi
    .fn()
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ deleteDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminación de dependencias' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Confirmar eliminación' });
  await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

  await waitFor(() => expect(deleteDependency).toHaveBeenCalledTimes(2));
  const retryDialog = await screen.findByRole('alertdialog', { name: 'Confirmar eliminación' });
  expect(retryDialog.textContent).toContain('esta dependencia');
  expect(retryDialog.textContent).not.toContain('estas dependencias');
  expect(deleteDependency).toHaveBeenNthCalledWith(1, 'dependency-1');
  expect(deleteDependency).toHaveBeenNthCalledWith(2, 'dependency-2');

  await user.click(within(retryDialog).getByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(deleteDependency).toHaveBeenCalledTimes(3));
  expect(deleteDependency).toHaveBeenLastCalledWith('dependency-2');
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('previews and confirms a dependency that propagates teacher blocks', async () => {
  const user = userEvent.setup();
  const connectNodes = vi.fn().mockResolvedValue(true);
  const previewRoadmapDependency = vi.fn().mockResolvedValue([
    { id: 'target-node', title: 'Destino afectado' },
    { id: 'descendant-node', title: 'Descendiente afectado' },
  ]);
  useRoadmapMock.mockReturnValue(roadmapActions({ connectNodes, previewRoadmapDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo' });
  expect(
    within(dialog).getByRole('listitem', {
      name: 'Relación: source-node → target-node',
    }),
  ).toBeTruthy();
  expect(within(dialog).getByRole('list', { name: 'Nodos que se bloquearán' })).toBeTruthy();
  expect(dialog.textContent).toContain('Destino afectado');
  expect(dialog.textContent).toContain('Descendiente afectado');
  await user.click(within(dialog).getByRole('button', { name: 'Conectar y bloquear' }));

  await waitFor(() =>
    expect(connectNodes).toHaveBeenCalledWith('source-node', 'target-node', 'right', 'left'),
  );
});

test('connects an unaffected dependency immediately without opening a confirmation', async () => {
  const user = userEvent.setup();
  const connectNodes = vi.fn().mockResolvedValue(true);
  const previewRoadmapDependency = vi.fn().mockResolvedValue([]);
  useRoadmapMock.mockReturnValue(roadmapActions({ connectNodes, previewRoadmapDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));

  await waitFor(() =>
    expect(connectNodes).toHaveBeenCalledWith('source-node', 'target-node', 'right', 'left'),
  );
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('keeps an impacted dependency confirmation recoverable after cancellation and failure', async () => {
  const user = userEvent.setup();
  const connectNodes = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const previewRoadmapDependency = vi
    .fn()
    .mockResolvedValue([{ id: 'target-node', title: 'Destino afectado' }]);
  useRoadmapMock.mockReturnValue(roadmapActions({ connectNodes, previewRoadmapDependency }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));
  let dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo' });
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(connectNodes).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));
  dialog = await screen.findByRole('alertdialog', { name: 'Confirmar bloqueo' });
  const confirm = within(dialog).getByRole('button', { name: 'Conectar y bloquear' });
  await user.click(confirm);
  await waitFor(() => expect(connectNodes).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole('alertdialog', { name: 'Confirmar bloqueo' })).toBeTruthy();

  await user.click(confirm);
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(connectNodes).toHaveBeenCalledTimes(2);
});
