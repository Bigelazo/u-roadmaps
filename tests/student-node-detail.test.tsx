import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { StudentNodeDetail } from '../src/components/roadmap/StudentNodeDetail';

const node = {
  id: 'node-1',
  title: 'Introduccion a algoritmos',
  description: 'Conceptos basicos',
  nodeTypeId: 'type-1',
  positionX: 0,
  positionY: 0,
  isVisible: true,
  isCompleted: false,
  canComplete: true,
  resources: [],
};

test('student can close a named mobile node-detail dialog with Escape or its close control', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();

  render(
    <StudentNodeDetail node={node} status="available" onClose={onClose} onComplete={vi.fn()} />,
  );

  expect(screen.getByRole('dialog', { name: node.title }).getAttribute('aria-modal')).toBe('true');

  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
  expect(onClose).toHaveBeenCalledTimes(2);
});
