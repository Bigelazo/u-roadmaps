import { expect, test } from 'vitest';
import { reconcileTitleNotice } from '@/features/notifications/application/reconcile-title';

test.each([
  [
    'creates from the known title',
    'Recursión',
    null,
    'Recursividad',
    { action: 'create', knownTitle: 'Recursión', currentTitle: 'Recursividad' },
  ],
  [
    'absorbs another rename',
    'Recursión',
    'Recursividad',
    'Recursividad avanzada',
    { action: 'update', knownTitle: 'Recursión', currentTitle: 'Recursividad avanzada' },
  ],
  ['withdraws a return to known', 'Pilas', 'Pila', 'Pilas', { action: 'withdraw' }],
  ['ignores an unchanged known title', 'Pilas', null, 'Pilas', { action: 'no-op' }],
  ['ignores an unchanged pending title', 'Pilas', 'Pila', 'Pila', { action: 'no-op' }],
  [
    'starts again after recognition',
    'Recursividad',
    null,
    'Recursividad avanzada',
    { action: 'create', knownTitle: 'Recursividad', currentTitle: 'Recursividad avanzada' },
  ],
] as const)('%s', (_name, knownTitle, pendingTitle, currentTitle, expected) => {
  expect(
    reconcileTitleNotice({
      knownTitle,
      pendingTitle,
      pendingKnownTitle: pendingTitle === null ? null : knownTitle,
      currentTitle,
    }),
  ).toEqual(expected);
});

test('rebases a later pending title onto the title captured by recognition', () => {
  expect(
    reconcileTitleNotice({
      knownTitle: 'Recursividad',
      pendingTitle: 'Recursividad avanzada',
      pendingKnownTitle: 'Recursión',
      currentTitle: 'Recursividad avanzada',
    }),
  ).toEqual({
    action: 'update',
    knownTitle: 'Recursividad',
    currentTitle: 'Recursividad avanzada',
  });
});
