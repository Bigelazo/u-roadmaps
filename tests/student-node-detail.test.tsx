import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { StudentNodeDetail } from '../src/features/roadmap/student/NodeDetail';

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

const nodeWithResources = {
  ...node,
  resources: [
    {
      id: 'resource-1',
      title: 'Guia de estudio',
      type: 'FILE' as const,
      url: 'https://example.com/guide.pdf',
    },
    {
      id: 'resource-2',
      title: 'Clase grabada',
      type: 'VIDEO' as const,
      url: 'https://example.com/class',
    },
  ],
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

test('student can complete an available node and open every resource in a new tab', async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();

  render(
    <StudentNodeDetail
      node={nodeWithResources}
      status="available"
      onClose={vi.fn()}
      onComplete={onComplete}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Completar' }));
  expect(onComplete).toHaveBeenCalledWith(nodeWithResources);

  const guide = screen.getByRole('link', { name: /Guia de estudio/i });
  expect(guide.getAttribute('href')).toBe(nodeWithResources.resources[0].url);
  expect(guide.getAttribute('target')).toBe('_blank');
  expect(guide.getAttribute('rel')).toBe('noreferrer');
  expect(screen.getByRole('link', { name: /Clase grabada/i }).getAttribute('href')).toBe(
    nodeWithResources.resources[1].url,
  );
});

test('student cannot complete a completed node', () => {
  render(
    <StudentNodeDetail node={node} status="completed" onClose={vi.fn()} onComplete={vi.fn()} />,
  );

  const completedButton = screen.getByRole('button', { name: 'Completado' }) as HTMLButtonElement;
  expect(completedButton.disabled).toBe(true);
});

test('student cannot complete a locked node and is told why', () => {
  render(<StudentNodeDetail node={node} status="locked" onClose={vi.fn()} onComplete={vi.fn()} />);

  const lockedButton = screen.getByRole('button', {
    name: 'Completa prerrequisitos',
  }) as HTMLButtonElement;
  expect(lockedButton.disabled).toBe(true);
  expect(
    screen.getByText('Este nodo se desbloquea cuando completes sus prerrequisitos.'),
  ).toBeTruthy();
});
