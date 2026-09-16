import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import {
  RoadmapCanvasForTest,
  identifier,
  roadmapActions,
  renderCanvas,
  useRoadmapMock,
} from './test-harness';

test('announces the loading state and renders a named error when the roadmap cannot load', async () => {
  useRoadmapMock.mockReturnValue(roadmapActions({ roadmap: null }));
  const { rerender } = renderCanvas();

  expect(screen.getByRole('status', { name: 'Cargando roadmap' })).toBeTruthy();
  expect(screen.getByText('Cargando roadmap...')).toBeTruthy();

  useRoadmapMock.mockReturnValue(
    roadmapActions({ roadmap: null, error: 'No se pudo cargar el roadmap.' }),
  );
  rerender(
    <RoadmapCanvasForTest
      identifier={identifier}
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={2}
    />,
  );

  expect((await screen.findByRole('alert')).textContent).toBe(
    'Error al cargar el roadmapNo se pudo cargar el roadmap.',
  );
});

test('shows the course code and localized term together in the canvas header', () => {
  useRoadmapMock.mockReturnValue(roadmapActions());
  renderCanvas(true);

  expect(screen.getByRole('heading', { name: 'Programación I' })).toBeTruthy();
  const courseCode = screen.getByText('CC1001');
  expect(courseCode.parentElement?.textContent).toBe('CC1001·Primavera 2026');
  expect(screen.getByText('Primavera 2026')).toBeTruthy();
  expect(screen.getByText('Modo edición')).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Leyenda del roadmap' })).toBeNull();
  const shortcuts = screen.getByRole('group', { name: 'Atajos de teclado' });
  expect(shortcuts).toHaveProperty('open', false);
  expect(within(shortcuts).getByText('Ocultar o mostrar el panel lateral.')).toBeTruthy();
  expect(within(shortcuts).getAllByText('Flechas')).toHaveLength(2);
  expect(within(shortcuts).getByLabelText('Shift')).toBeTruthy();
  expect(within(shortcuts).getByText('Tab')).toBeTruthy();
  expect(within(shortcuts).getByText('Ctrl')).toBeTruthy();
  expect(
    within(shortcuts).getByText(
      /Con el borde del panel enfocado, establecer su ancho mínimo o máximo/,
    ),
  ).toBeTruthy();
  const canvas = screen.getByLabelText('Lienzo del roadmap');
  expect(canvas.className).toContain('lg:min-h-0');
  expect(shortcuts.getAttribute('data-placement')).toBe('roadmap');
  expect(canvas.parentElement?.className).toContain('lg:grid-rows-[minmax(0,1fr)]');
  expect(canvas.parentElement?.parentElement?.className).toContain('lg:h-full');
});

test('uses Otoño for first-semester roadmaps', () => {
  useRoadmapMock.mockReturnValue(roadmapActions());
  render(
    <RoadmapCanvasForTest
      identifier={{ ...identifier, semester: 1 }}
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={1}
    />,
  );

  expect(screen.getByText('Otoño 2026')).toBeTruthy();
});

test('surfaces a mutation error as a dismissible toast over the canvas', async () => {
  const user = userEvent.setup();
  const connectNodes = vi.fn().mockResolvedValue(false);
  useRoadmapMock.mockReturnValue(
    roadmapActions({ error: 'La dependencia ya existe.', connectNodes }),
  );
  renderCanvas(true);

  await user.click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));

  expect(
    (await screen.findByRole('alert', { name: 'La dependencia ya existe.' })).textContent,
  ).toBe('La dependencia ya existe.');

  await user.click(screen.getByRole('button', { name: 'Cerrar alerta' }));
  expect(screen.queryByRole('alert', { name: 'La dependencia ya existe.' })).toBeNull();
});

test('surfaces a concurrent hidden-node dependency error over the canvas', async () => {
  const connectNodes = vi.fn().mockResolvedValue(false);
  useRoadmapMock.mockReturnValue(
    roadmapActions({
      error: 'No se pueden crear dependencias con nodos ocultos.',
      connectNodes,
    }),
  );
  renderCanvas(true);

  await userEvent.setup().click(screen.getByRole('button', { name: 'Conectar rama bloqueada' }));

  expect(
    await screen.findByRole('alert', {
      name: 'No se pueden crear dependencias con nodos ocultos.',
    }),
  ).toBeTruthy();
});
