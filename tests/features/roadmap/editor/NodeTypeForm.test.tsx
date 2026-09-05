import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { NodeTypeForm } from '@/features/roadmap/editor/NodeTypeForm';
import type { NodeTypeDraft } from '@/features/roadmap/editor/types';

function FormHarness({ initial = { name: '' } }: { initial?: NodeTypeDraft }) {
  const [value, setValue] = useState(initial);
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  return <NodeTypeForm value={value} onChange={setValue} onSubmit={onSubmit} />;
}

test('requires an explicit name, icon, and color before creating a node type', async () => {
  const user = userEvent.setup();
  render(<FormHarness />);

  const create = screen.getByRole('button', { name: 'Crear tipo' });
  expect((create as HTMLButtonElement).disabled).toBe(true);
  await user.type(screen.getByLabelText('Nombre'), 'Laboratorio');
  expect((create as HTMLButtonElement).disabled).toBe(true);

  await user.click(screen.getByRole('button', { name: 'Icono: sin selección' }));
  const iconPicker = await screen.findByRole('dialog', { name: 'Elegir Icono' });
  expect(within(iconPicker).getAllByRole('button')).toHaveLength(80);
  expect(within(iconPicker).getByRole('region', { name: 'Contenido y lectura' })).toBeTruthy();
  await user.click(within(iconPicker).getByRole('button', { name: 'Libro abierto' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Elegir Icono' })).toBeNull());
  expect((create as HTMLButtonElement).disabled).toBe(true);

  await user.click(screen.getByRole('button', { name: 'Color: sin selección' }));
  const colorPicker = await screen.findByRole('dialog', { name: 'Elegir color' });
  expect(within(colorPicker).getAllByRole('button')).toHaveLength(20);
  await user.click(within(colorPicker).getByRole('button', { name: 'Azul institucional' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Elegir color' })).toBeNull());
  expect((create as HTMLButtonElement).disabled).toBe(false);
});

test('preloads the current appearance and exposes selected choices to assistive technology', async () => {
  const user = userEvent.setup();
  render(<FormHarness initial={{ name: 'Laboratorio', icon: 'FlaskConical', color: '#287A3D' }} />);

  expect(screen.getByRole('button', { name: 'Icono: Química' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Color: Verde hoja' })).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Icono: Química' }));
  expect(screen.getByRole('button', { name: 'Química', pressed: true })).toBeTruthy();
});
