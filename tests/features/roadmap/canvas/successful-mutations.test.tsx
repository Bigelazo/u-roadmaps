import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { roadmap, roadmapActions, renderCanvas, useRoadmapMock } from './test-harness';

test('creates nodes from the floating canvas button', async () => {
  const user = userEvent.setup();
  const addNode = vi.fn().mockImplementation(async (_node, _position, onCreated) => {
    onCreated?.('created-node');
    return true;
  });
  useRoadmapMock.mockReturnValue(roadmapActions({ addNode }));
  renderCanvas(true);

  const floatingButton = screen.getByRole('button', { name: 'Crear en el mapa' });
  expect(floatingButton.className).toContain('rounded-full');
  expect(floatingButton.className).toContain('cursor-pointer');
  await user.pointer({ keys: '[MouseLeft>]', target: floatingButton });
  await user.pointer({ keys: '[/MouseLeft]' });
  expect(screen.getByRole('menuitem', { name: 'Crear nodo' })).toBeTruthy();
  await user.click(screen.getByRole('menuitem', { name: 'Crear nodo' }));
  const dialog = screen.getByRole('dialog', { name: 'Agregar al mapa' });
  expect(within(dialog).getByRole('combobox', { name: 'Tipo' }).textContent).toContain('Contenido');
  await user.type(within(dialog).getByLabelText('Título'), 'Repasar límites');
  await user.click(within(dialog).getByRole('button', { name: 'Agregar nodo' }));

  expect(addNode).toHaveBeenCalledWith(
    {
      title: 'Repasar límites',
      description: '',
      nodeTypeId: 'content',
      isVisible: true,
    },
    { x: 280, y: 260 },
    expect.any(Function),
  );
  await waitFor(() =>
    expect(screen.getByTestId('selected-roadmap-node').textContent).toBe('created-node'),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('manages node types from the floating canvas button', async () => {
  const user = userEvent.setup();
  const addNodeType = vi.fn().mockResolvedValue(true);
  const updateNodeType = vi.fn().mockResolvedValue(true);
  const deleteNodeType = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ addNodeType, updateNodeType, deleteNodeType }));
  const { unmount } = renderCanvas(true);

  const floatingButton = screen.getByRole('button', { name: 'Crear en el mapa' });
  await user.pointer({ keys: '[MouseLeft>]', target: floatingButton });
  await user.pointer({ keys: '[/MouseLeft]' });
  expect(screen.getByRole('menuitem', { name: 'Gestionar tipos de nodo' })).toBeTruthy();
  await user.click(screen.getByRole('menuitem', { name: 'Gestionar tipos de nodo' }));
  const dialog = screen.getByRole('dialog', { name: 'Tipos de nodo' });
  await user.type(within(dialog).getByLabelText('Nombre'), 'Laboratorio');
  await user.click(within(dialog).getByRole('button', { name: 'Icono: sin selección' }));
  await user.click(screen.getByRole('button', { name: 'Libro abierto' }));
  await user.click(within(dialog).getByRole('button', { name: 'Color: sin selección' }));
  await user.click(screen.getByRole('button', { name: 'Azul institucional' }));
  await user.click(within(dialog).getByRole('button', { name: 'Crear tipo' }));

  expect(addNodeType).toHaveBeenCalledWith({
    name: 'Laboratorio',
    icon: 'BookOpen',
    color: '#024AD8',
  });
  expect(screen.getByRole('dialog', { name: 'Tipos de nodo' })).toBeTruthy();

  const customType = {
    id: 'lab',
    name: 'Laboratorio',
    icon: 'BookOpen',
    color: '#024AD8',
    isPredefined: false,
  };
  unmount();
  useRoadmapMock.mockReturnValue(
    roadmapActions({
      roadmap: { ...roadmap, nodeTypes: [...roadmap.nodeTypes, customType] },
      updateNodeType,
      deleteNodeType,
    }),
  );
  renderCanvas(true);
  await user.pointer({
    keys: '[MouseLeft>]',
    target: screen.getByRole('button', { name: 'Crear en el mapa' }),
  });
  await user.pointer({ keys: '[/MouseLeft]' });
  await user.click(screen.getByRole('menuitem', { name: 'Gestionar tipos de nodo' }));
  const managementDialog = screen.getByRole('dialog', { name: 'Tipos de nodo' });
  await user.click(
    within(managementDialog).getByRole('button', { name: 'Editar tipo Laboratorio' }),
  );
  const nameInput = within(managementDialog).getByLabelText('Nombre');
  await user.clear(nameInput);
  await user.type(nameInput, 'Laboratorio de código');
  await user.click(within(managementDialog).getByRole('button', { name: 'Guardar tipo' }));
  expect(updateNodeType).toHaveBeenCalledWith('lab', {
    name: 'Laboratorio de código',
    icon: 'BookOpen',
    color: '#024AD8',
  });

  await user.click(
    within(managementDialog).getByRole('button', { name: 'Eliminar tipo Laboratorio de código' }),
  );
  const deletionDialog = await screen.findByRole('alertdialog', {
    name: 'Confirmar eliminación',
  });
  expect(deletionDialog.getAttribute('data-intent')).toBe('destructive');
  expect(
    within(deletionDialog).getByRole('listitem', { name: 'Laboratorio de código' }),
  ).toBeTruthy();
  await user.click(within(deletionDialog).getByRole('button', { name: 'Cancelar' }));
  expect(deleteNodeType).not.toHaveBeenCalled();

  await user.click(
    within(managementDialog).getByRole('button', { name: 'Eliminar tipo Laboratorio de código' }),
  );
  const retryDialog = await screen.findByRole('alertdialog', { name: 'Confirmar eliminación' });
  const confirm = within(retryDialog).getByRole('button', { name: 'Eliminar' });
  await user.click(confirm);
  await waitFor(() => expect(deleteNodeType).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole('alertdialog', { name: 'Confirmar eliminación' })).toBeTruthy();

  await user.click(confirm);
  await waitFor(() => expect(deleteNodeType).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('persists every repositioned node after ordering the map', async () => {
  const user = userEvent.setup();
  const moveNode = vi.fn();
  useRoadmapMock.mockReturnValue(roadmapActions({ moveNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Ordenar mapa' }));
  expect(moveNode).toHaveBeenCalledWith('node-1', { x: 40, y: 80 });
});

test('confirms that a node update was saved successfully', async () => {
  const user = userEvent.setup();
  const updateNode = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ updateNode }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

  expect(
    await screen.findByRole('status', { name: 'Cambios guardados exitosamente.' }),
  ).toBeTruthy();
  expect(updateNode).toHaveBeenCalledWith('node-1', {
    title: 'Límites',
    description: '',
    nodeTypeId: 'content',
  });
});

test('confirms that a link was saved successfully', async () => {
  const user = userEvent.setup();
  const addResource = vi.fn().mockResolvedValue(true);
  useRoadmapMock.mockReturnValue(roadmapActions({ addResource }));
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Activar nodo docente' }));
  await user.click(screen.getByRole('button', { name: 'Guardar enlace' }));

  expect(await screen.findByRole('status', { name: 'Enlace guardado exitosamente.' })).toBeTruthy();
  expect(addResource).toHaveBeenCalledWith('node-1', {
    title: 'Guía de ejercicios',
    url: 'https://example.test/guia',
    type: 'LINK',
  });
});
