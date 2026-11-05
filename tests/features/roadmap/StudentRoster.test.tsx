import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { StudentRoster } from '@/features/roadmap/ui/StudentRoster';
import type { CourseMember } from '@/features/roadmap/course-participants-types';

const students: CourseMember[] = [
  {
    key: 'a',
    name: 'Neira, Álvaro',
    sections: ['1'],
    institutionalPosition: 'STUDENT',
    hasEntered: true,
    completedNodes: 7,
    completion: 0.5,
  },
  {
    key: 'b',
    name: 'Pérez, Ana',
    sections: ['2'],
    institutionalPosition: 'OBSERVER',
    hasEntered: false,
    completedNodes: 0,
    completion: 0,
  },
];

test('search ignores accents and case, and clearing an empty result restores the roster', async () => {
  const user = userEvent.setup();
  render(<StudentRoster students={students} visibleNodes={14} hasRoadmap />);
  const search = screen.getByRole('searchbox', { name: 'Buscar estudiante por nombre' });
  await user.type(search, 'ALVARO neira');
  expect(screen.getByRole('row', { name: 'Neira, Álvaro' })).toBeTruthy();
  expect(screen.queryByRole('row', { name: 'Pérez, Ana' })).toBeNull();
  await user.clear(search);
  await user.type(search, 'sin coincidencias');
  expect(screen.getByText('No encontramos estudiantes con ese nombre.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
  expect(screen.getByRole('row', { name: 'Pérez, Ana' })).toBeTruthy();
});

test('retains observer and entry exceptions, and exposes completion independently of color', () => {
  render(<StudentRoster students={students} visibleNodes={14} hasRoadmap />);
  const observer = within(screen.getByRole('row', { name: 'Pérez, Ana' }));
  expect(observer.getByText('Oyente · fuera del promedio')).toBeTruthy();
  expect(observer.getByText('Sin ingreso')).toBeTruthy();
  expect(
    screen
      .getByRole('progressbar', { name: 'Completación de Neira, Álvaro' })
      .getAttribute('aria-valuenow'),
  ).toBe('50');
});

test('without a roadmap, keeps names and sections without presenting progress', () => {
  render(<StudentRoster students={students} visibleNodes={0} hasRoadmap={false} />);
  expect(screen.getByRole('row', { name: 'Neira, Álvaro' })).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Sección' })).toBeTruthy();
  expect(screen.queryByRole('columnheader', { name: 'Avance' })).toBeNull();
  expect(screen.queryByRole('progressbar')).toBeNull();
});
