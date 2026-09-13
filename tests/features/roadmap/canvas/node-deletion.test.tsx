import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import type { NodeDeletionImpact } from '@/features/roadmap/types';
import { roadmapActions, renderCanvas, useRoadmapMock } from './test-harness';

function deletionImpact(version = 'delete-preview'): NodeDeletionImpact {
  return {
    node: {
      title: 'Límites',
      nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
    },
    dependencies: [],
    resources: [],
    version,
  };
}

test('shows the authoritative named deletion impact and deletes only after a fresh preview', async () => {
  const user = userEvent.setup();
  const impact = {
    ...deletionImpact(),
    dependencies: [
      { id: 'dependency-1', sourceTitle: 'Base', targetTitle: 'Límites' },
      { id: 'dependency-2', sourceTitle: 'Límites', targetTitle: 'Derivadas' },
    ],
    resources: [{ id: 'resource-1', title: 'Guía de ejercicios' }],
  };
  const previewNodeDeletion = vi.fn().mockResolvedValue(impact);
  const deleteNode = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewNodeDeletion, deleteNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' });
  expect(dialog.getAttribute('data-intent')).toBe('destructive');
  expect(within(dialog).getByRole('listitem', { name: 'Límites' })).toBeTruthy();
  expect(within(dialog).getByRole('list', { name: 'Dependencias relacionadas' })).toBeTruthy();
  expect(within(dialog).getByRole('list', { name: 'Recursos que se eliminarán' })).toBeTruthy();
  expect(dialog.textContent).toContain('Límites');
  expect(dialog.textContent).toContain('Base');
  expect(dialog.textContent).toContain('Base');
  expect(dialog.textContent).toContain('Derivadas');
  expect(dialog.textContent).toContain('Guía de ejercicios');
  expect(dialog.textContent).not.toContain('Completaciones');
  expect(screen.getByLabelText('Contenido')).toBeTruthy();

  await user.click(within(dialog).getByRole('button', { name: 'Eliminar Nodo' }));
  await waitFor(() => expect(deleteNode).toHaveBeenCalledWith('node-1', 'delete-preview'));
  expect(previewNodeDeletion).toHaveBeenCalledTimes(2);
});

test('blocks duplicate deletion previews while the authoritative preview is pending', async () => {
  const user = userEvent.setup();
  const impact = deletionImpact();
  let resolvePreview!: (nextImpact: typeof impact) => void;
  const previewNodeDeletion = vi.fn(
    () => new Promise<typeof impact>((resolve) => (resolvePreview = resolve)),
  );
  useRoadmapMock.mockReturnValue(roadmapActions({ previewNodeDeletion }));
  renderCanvas(true);

  const request = screen.getByRole('button', { name: 'Solicitar eliminar nodo' });
  await user.click(request);
  await user.click(request);

  expect(previewNodeDeletion).toHaveBeenCalledTimes(1);
  resolvePreview(impact);
  expect(await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' })).toBeTruthy();
});

test('clears the selected editor after successful node deletion', async () => {
  const user = userEvent.setup();
  const deleteNode = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ deleteNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  expect(screen.getByTestId('editor-panel')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' });
  await user.click(within(dialog).getByRole('button', { name: 'Eliminar Nodo' }));

  await waitFor(() => expect(deleteNode).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByTestId('editor-panel')).toBeNull());
  expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('');
});

test('keeps preview-backed node deletion recoverable after a failed mutation', async () => {
  const user = userEvent.setup();
  const deleteNode = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ deleteNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' });
  const confirm = within(dialog).getByRole('button', { name: 'Eliminar Nodo' });

  await user.click(confirm);
  await waitFor(() => expect(deleteNode).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole('alertdialog', { name: 'Eliminar Nodo' })).toBeTruthy();

  await user.click(confirm);
  await waitFor(() => expect(deleteNode).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('updates a changed deletion impact and requires a renewed confirmation', async () => {
  const user = userEvent.setup();
  const initialImpact = deletionImpact('one');
  const changedImpact = {
    ...initialImpact,
    dependencies: [{ id: 'dependency-1', sourceTitle: 'Base', targetTitle: 'Límites' }],
    version: 'two',
  };
  const previewNodeDeletion = vi
    .fn()
    .mockResolvedValueOnce(initialImpact)
    .mockResolvedValueOnce(changedImpact)
    .mockResolvedValueOnce(changedImpact);
  const deleteNode = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ previewNodeDeletion, deleteNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Solicitar eliminar nodo' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar Nodo' });
  await user.click(within(dialog).getByRole('button', { name: 'Eliminar Nodo' }));

  expect(deleteNode).not.toHaveBeenCalled();
  expect(dialog.textContent).toContain('Base');
  await user.click(within(dialog).getByRole('button', { name: 'Eliminar Nodo' }));
  await waitFor(() => expect(deleteNode).toHaveBeenCalledWith('node-1', 'two'));
});
