import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { NodeTypesEditor } from '@/features/roadmap/editor/NodeTypesEditor';
import type { NodeTypeInput } from '@/features/roadmap/editor/types';
import type { NodeType } from '@/features/roadmap/types';

const predefined: NodeType = {
  id: 'content',
  name: 'Contenido',
  icon: 'BookOpen',
  color: '#024AD8',
  isPredefined: true,
};
const custom: NodeType = {
  id: 'lab',
  name: 'Laboratorio',
  icon: 'FlaskConical',
  color: '#9333EA',
  isPredefined: false,
};

function Harness({
  save = async () => true,
  nodes = [],
  onDelete = () => undefined,
}: {
  save?: (input: NodeTypeInput) => Promise<boolean>;
  nodes?: { nodeTypeId: string }[];
  onDelete?: (type: NodeType) => void;
}) {
  const [open, setOpen] = useState(true);
  const [types, setTypes] = useState([predefined, custom]);
  return (
    <NodeTypesEditor
      open={open}
      onOpenChange={setOpen}
      nodeTypes={types}
      nodes={nodes}
      onAdd={async (input) => {
        if (!(await save(input))) return false;
        setTypes((current) => [...current, { ...input, id: 'new', isPredefined: false }]);
        return true;
      }}
      onUpdate={async (id, input) => {
        if (!(await save(input))) return false;
        setTypes((current) =>
          current.map((type) => (type.id === id ? { ...type, ...input } : type)),
        );
        return true;
      }}
      onRequestDelete={onDelete}
    />
  );
}

test('preserves the draft when a save fails and retries the same update', async () => {
  const user = userEvent.setup();
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<Harness save={save} />);
  await user.click(screen.getByRole('button', { name: 'Editar tipo Laboratorio' }));
  expect(
    (screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  await user.clear(screen.getByLabelText('Nombre'));
  await user.type(screen.getByLabelText('Nombre'), 'Taller');
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Tus cambios siguen aquí');
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Taller');
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('Cambios guardados en «Taller»'),
  );
  expect(screen.getByRole('button', { name: 'Editar tipo Taller' })).toBeTruthy();
  expect(save).toHaveBeenCalledTimes(2);
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('');
});

test('checks duplicate names with the same normalization as the domain', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByLabelText('Nombre'), '  CONTENIDO  ');
  expect(screen.getByRole('alert').textContent).toContain(
    'Ya existe un tipo disponible con ese nombre.',
  );
  expect(screen.getByLabelText('Nombre').getAttribute('aria-invalid')).toBe('true');
  expect((screen.getByRole('button', { name: 'Crear tipo' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});

test('guards both switching type and closing with unsaved changes', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByLabelText('Nombre'), 'Ejercicio');
  await user.click(screen.getByRole('button', { name: 'Editar tipo Laboratorio' }));
  expect((await screen.findByRole('alertdialog')).textContent).toContain(
    '¿Descartar los cambios sin guardar?',
  );
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ejercicio');
  await user.click(screen.getByRole('button', { name: 'Cerrar tipos de nodo' }));
  await user.click(await screen.findByRole('button', { name: 'Descartar cambios' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tipos de nodo' })).toBeNull());
});

test('explains usage before deletion and requests confirmation only for unused types', async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn();
  const { rerender } = render(<Harness nodes={[{ nodeTypeId: custom.id }]} onDelete={onDelete} />);
  expect(
    (screen.getByRole('button', { name: 'Eliminar tipo Laboratorio' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Editar tipo Laboratorio' }));
  expect(screen.getByText('Los cambios se aplicarán a 1 nodo que usa este tipo.')).toBeTruthy();
  rerender(<Harness onDelete={onDelete} />);
  await user.click(screen.getByRole('button', { name: 'Eliminar tipo Laboratorio' }));
  expect(onDelete).toHaveBeenCalledWith(custom);
  expect(screen.queryByRole('button', { name: 'Eliminar tipo Contenido' })).toBeNull();
});

test('prevents repeated requests and closing while saving', async () => {
  const user = userEvent.setup();
  let finish!: (saved: boolean) => void;
  const save = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  render(<Harness save={save} />);
  await user.click(screen.getByRole('button', { name: 'Editar tipo Laboratorio' }));
  await user.type(screen.getByLabelText('Nombre'), ' avanzado');
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect((screen.getByRole('button', { name: 'Guardando…' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(
    (screen.getByRole('button', { name: 'Cerrar tipos de nodo' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog', { name: 'Tipos de nodo' })).toBeTruthy();
  expect(save).toHaveBeenCalledTimes(1);
  finish(true);
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('Cambios guardados'),
  );
});
