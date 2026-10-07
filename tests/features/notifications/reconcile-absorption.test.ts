import { expect, test } from 'vitest';
import { reconcileAbsorption } from '@/features/notifications/application/reconcile-absorption';

test('a new visible Node absorbs every later change into its creation', () => {
  expect(
    reconcileAbsorption({ roadmapAvailable: false, newNode: true, nodeState: 'Disponible' }),
  ).toBe('creation');
});

test('a pending new Node remains new while blocked, withdraws while hidden or deleted, and returns as new', () => {
  for (const nodeState of ['Bloqueado', 'Disponible'] as const)
    expect(reconcileAbsorption({ roadmapAvailable: false, newNode: true, nodeState })).toBe(
      'creation',
    );
  for (const nodeState of ['Retirado', 'deleted'] as const)
    expect(reconcileAbsorption({ roadmapAvailable: false, newNode: true, nodeState })).toBe(
      'withdraw',
    );
});

test('deletion absorbs independent pending Node targets', () => {
  expect(
    reconcileAbsorption({ roadmapAvailable: false, newNode: false, nodeState: 'deleted' }),
  ).toBe('deletion');
  expect(
    reconcileAbsorption({ roadmapAvailable: false, newNode: false, nodeState: 'Bloqueado' }),
  ).toBe('independent');
});

test('Roadmap availability absorbs every later target, including Node creation and deletion', () => {
  for (const newNode of [true, false])
    for (const nodeState of ['Disponible', 'Bloqueado', 'Retirado', 'deleted', null] as const)
      expect(reconcileAbsorption({ roadmapAvailable: true, newNode, nodeState })).toBe(
        'availability',
      );
});
