import { expect, test } from 'vitest';
import { reconcileNodeContentNotice } from '@/features/notifications/application/reconcile-node-content';

test('description edits absorb changes and withdraw only an exact return to known text', () => {
  expect(
    reconcileNodeContentNotice({
      knownValue: 'Texto original',
      pendingValue: 'Segundo texto',
      pendingKnownValue: 'Texto original',
      currentValue: 'Texto original ',
    }),
  ).toEqual({ action: 'update', knownValue: 'Texto original', currentValue: 'Texto original ' });
  expect(
    reconcileNodeContentNotice({
      knownValue: 'Texto original',
      pendingValue: 'Segundo texto',
      pendingKnownValue: 'Texto original',
      currentValue: 'Texto original',
    }),
  ).toEqual({ action: 'withdraw' });
});

test('type A → B → C compares identity A to C; A → B → A withdraws', () => {
  expect(
    reconcileNodeContentNotice({
      knownValue: 'type-a',
      pendingValue: 'type-b',
      pendingKnownValue: 'type-a',
      currentValue: 'type-c',
    }),
  ).toEqual({ action: 'update', knownValue: 'type-a', currentValue: 'type-c' });
  expect(
    reconcileNodeContentNotice({
      knownValue: 'type-a',
      pendingValue: 'type-b',
      pendingKnownValue: 'type-a',
      currentValue: 'type-a',
    }),
  ).toEqual({ action: 'withdraw' });
});

test('an unchanged type identity preserves its pending snapshot after a type rename', () => {
  expect(
    reconcileNodeContentNotice({
      knownValue: 'type-a',
      pendingValue: 'type-b',
      pendingKnownValue: 'type-a',
      currentValue: 'type-b',
    }),
  ).toEqual({ action: 'no-op' });
});

test('recognition rebases later content onto the captured value', () => {
  expect(
    reconcileNodeContentNotice({
      knownValue: 'Recognized description',
      pendingValue: 'Later description',
      pendingKnownValue: 'Original description',
      currentValue: 'Later description',
    }),
  ).toEqual({
    action: 'update',
    knownValue: 'Recognized description',
    currentValue: 'Later description',
  });
});

test('access Disponible → Retirado → Disponible → Bloqueado collapses against Disponible', () => {
  expect(
    reconcileNodeContentNotice({
      knownValue: 'Disponible',
      pendingValue: 'Retirado',
      pendingKnownValue: 'Disponible',
      currentValue: 'Bloqueado',
    }),
  ).toEqual({ action: 'update', knownValue: 'Disponible', currentValue: 'Bloqueado' });
});

test('access block → unblock withdraws the pending target on return to known', () => {
  expect(
    reconcileNodeContentNotice({
      knownValue: 'Disponible',
      pendingValue: 'Bloqueado',
      pendingKnownValue: 'Disponible',
      currentValue: 'Disponible',
    }),
  ).toEqual({ action: 'withdraw' });
});
