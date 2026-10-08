import { expect, test } from 'vitest';
import { reconcileNodeContentNotice } from '@/features/notifications/application/reconcile-node-content';

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
