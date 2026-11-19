import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { NodeTypeForm } from '@/features/roadmap/editor/NodeTypeForm';
import type { NodeTypeDraft } from '@/features/roadmap/editor/types';

function FormHarness({
  initial = { name: '' },
  onSubmit = vi.fn().mockResolvedValue(undefined),
}: {
  initial?: NodeTypeDraft;
  onSubmit?: () => Promise<void>;
}) {
  const [value, setValue] = useState(initial);

  return (
    <NodeTypeForm
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      onCancel={() => setValue({ name: '' })}
      reservedIcons={['BookOpen', 'ClipboardCheck', 'LibraryBig']}
    />
  );
}

test('shows inline errors instead of native validation when submitting an empty node type', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<FormHarness onSubmit={onSubmit} />);

  const name = screen.getByLabelText<HTMLInputElement>('Nombre');
  expect(name.hasAttribute('required')).toBe(false);
  expect(name.form?.noValidate).toBe(true);
  expect(screen.queryByRole('alert')).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Crear tipo' }));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(name.matches(':focus')).toBe(true);
  expect(name.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Escribe un nombre para el tipo.').id).toBe(
    name.getAttribute('aria-describedby'),
  );
  const icon = screen.getByRole('button', { name: 'Icono: sin selección' });
  expect(icon.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Elige un icono para el tipo.')).toBeTruthy();
  expect(screen.getByText('Elige un color para el tipo.')).toBeTruthy();

  await user.type(name, 'Laboratorio');
  expect(name.getAttribute('aria-invalid')).toBeNull();
  expect(screen.queryByText('Escribe un nombre para el tipo.')).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Crear tipo' }));
  expect(icon.matches(':focus')).toBe(true);
  expect(onSubmit).not.toHaveBeenCalled();
});

test('cancelling hides the inline errors of the discarded draft', async () => {
  const user = userEvent.setup();
  render(<FormHarness />);

  await user.click(screen.getByRole('button', { name: 'Crear tipo' }));
  expect(screen.getByText('Escribe un nombre para el tipo.')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  const name = screen.getByLabelText('Nombre');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(name.getAttribute('aria-invalid')).toBeNull();
});

test('requires an explicit name, icon, and color before creating a node type', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<FormHarness onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText('Nombre'), 'Laboratorio');

  await user.click(screen.getByRole('button', { name: 'Icono: sin selección' }));
  const iconPicker = await screen.findByRole('dialog', { name: 'Elegir icono' });
  expect(within(iconPicker).getAllByRole('button')).toHaveLength(77);
  expect(within(iconPicker).queryByRole('button', { name: 'Libro abierto' })).toBeNull();
  expect(within(iconPicker).queryByRole('button', { name: 'Biblioteca' })).toBeNull();
  expect(within(iconPicker).queryByRole('button', { name: 'Lista verificada' })).toBeNull();
  expect(within(iconPicker).getByRole('region', { name: 'Contenido y lectura' })).toBeTruthy();
  await user.click(within(iconPicker).getByRole('button', { name: 'Libro con texto' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Elegir icono' })).toBeNull());

  await user.click(screen.getByRole('button', { name: 'Crear tipo' }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText('Elige un color para el tipo.')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Color: sin selección' }));
  const colorPicker = await screen.findByRole('dialog', { name: 'Elegir color' });
  expect(within(colorPicker).getAllByRole('button')).toHaveLength(12);
  await user.click(within(colorPicker).getByRole('button', { name: 'Azul institucional' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Elegir color' })).toBeNull());
  expect(screen.queryByRole('alert')).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Crear tipo' }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test('preloads the current appearance and exposes selected choices to assistive technology', async () => {
  const user = userEvent.setup();
  render(<FormHarness initial={{ name: 'Laboratorio', icon: 'FlaskConical', color: '#E0A800' }} />);

  expect(screen.getByRole('button', { name: 'Icono: Química' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Color: Amarillo' })).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Icono: Química' }));
  expect(screen.getByRole('button', { name: 'Química', pressed: true })).toBeTruthy();
});
