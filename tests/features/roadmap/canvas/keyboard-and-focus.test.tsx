import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { roadmapActions, renderCanvas, useRoadmapMock } from './test-harness';

test('hides editor-only keyboard shortcuts from students', () => {
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas();

  const shortcuts = screen.getByRole('group', { name: 'Atajos de teclado' });
  expect(within(shortcuts).queryByText('Flechas')).toBeNull();
  expect(
    within(shortcuts).queryByText('Eliminar la dependencia seleccionada, con confirmación.'),
  ).toBeNull();
});

test('closes the selected-node sidebar on Escape without tying that behavior to canvas clicks', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(false);

  await user.click(screen.getByRole('button', { name: 'Cerrar nodo con Escape' }));
  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(true);
});

test('closes the editor sidebar on Escape when the selected node is no longer available', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo inexistente' }));
  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(false);

  await user.keyboard('{Escape}');
  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(true);
});

test('persists a position reached with the keyboard', async () => {
  const user = userEvent.setup();
  const moveNode = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ moveNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Mover nodo con teclado' }));

  expect(moveNode).toHaveBeenCalledWith('node-1', { x: 20, y: 0 });
});

test('toggles the selected editor sidebar with the platform shortcut', async () => {
  const user = userEvent.setup();
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);
  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));

  await user.keyboard('{Meta>}b{/Meta}');
  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(true);

  await user.keyboard('{Meta>}b{/Meta}');
  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(false);

  await user.keyboard('{Control>}b{/Control}');
  expect(screen.getByLabelText('Panel de edición del roadmap').hasAttribute('hidden')).toBe(true);
});
