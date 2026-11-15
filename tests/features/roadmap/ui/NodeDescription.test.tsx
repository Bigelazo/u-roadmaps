import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { NodeDescription } from '@/features/roadmap/ui/NodeDescription';

test('renders tables, strikethrough and task lists', () => {
  render(
    <NodeDescription
      description={
        '| Nombre | Nota |\n| --- | --- |\n| Ana | 7 |\n\n~~viejo~~\n\n- [x] Hecha\n- [ ] Pendiente'
      }
    />,
  );

  expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
    'Nombre',
    'Nota',
  ]);
  expect(screen.getByRole('cell', { name: 'Ana' })).toBeTruthy();
  expect(screen.getByText('viejo').tagName).toBe('DEL');
  expect(screen.getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual([
    true,
    false,
  ]);
});

test('a single tilde is not strikethrough, matching the editor', () => {
  render(<NodeDescription description="H~2~O" />);
  expect(screen.getByText('H~2~O')).toBeTruthy();
});
