import { expect, test } from 'vitest';
import {
  dependencyTarget,
  reconcileRouteNotice,
} from '@/features/notifications/application/reconcile-route';

test('Dependency identity belongs to the directed pair, independent of edge identity', () => {
  expect(dependencyTarget('colas', 'arboles')).toBe('dependency:colas:arboles');
  expect(dependencyTarget('arboles', 'colas')).toBe('dependency:arboles:colas');
});

test('adding and removing before recognition withdraws the pair; reversal changes two targets', () => {
  expect(reconcileRouteNotice('false', 'true')).toBe('dependency-added');
  expect(reconcileRouteNotice('true', 'false')).toBe('dependency-removed');
  expect(reconcileRouteNotice('false', 'false')).toBeNull();
  expect(reconcileRouteNotice('true', 'true')).toBeNull();
});

test('type renames compare known and current names, withdrawing a return', () => {
  expect(reconcileRouteNotice('Lectura', 'Taller', 'type')).toBe('classification-updated');
  expect(reconcileRouteNotice('Lectura', 'Lectura obligatoria', 'type')).toBe(
    'classification-updated',
  );
  expect(reconcileRouteNotice('Lectura', 'Lectura', 'type')).toBeNull();
});
