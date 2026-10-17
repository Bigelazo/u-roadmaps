import { expect, test } from 'vitest';
import { decideChangeImpactVersion } from '@/features/roadmap/domain/change-impact';

test.each([
  ['hide', 'NODE_VISIBILITY_PREVIEW_STALE', 'El impacto de ocultar el nodo cambió.'],
  ['delete', 'NODE_DELETE_PREVIEW_STALE', 'El impacto de la eliminación cambió.'],
  ['dependency', 'DEPENDENCY_PREVIEW_STALE', 'El impacto de la dependencia cambió.'],
  ['block', 'TEACHER_BLOCK_PREVIEW_STALE', 'El impacto del bloqueo cambió.'],
  ['unlock', 'TEACHER_BLOCK_PREVIEW_STALE', 'El impacto del desbloqueo cambió.'],
] as const)('rejects a stale %s preview version', (change, reason, message) => {
  expect(
    decideChangeImpactVersion({ change, sentVersion: 'previewed', version: 'current' }),
  ).toEqual({
    kind: 'REJECTED',
    reason,
    message: `${message} Revisa y confirma la previsualización actualizada.`,
  });
});

test('allows a preview version that still matches the Change impact', () => {
  expect(
    decideChangeImpactVersion({ change: 'unlock', sentVersion: 'same', version: 'same' }),
  ).toEqual({
    kind: 'ALLOWED',
  });
});

test.each(['hide', 'delete', 'dependency', 'block'] as const)(
  'allows a %s confirmation that sends no preview version',
  (change) => {
    expect(
      decideChangeImpactVersion({ change, sentVersion: undefined, version: 'current' }),
    ).toEqual({
      kind: 'ALLOWED',
    });
  },
);

test('requires an unlock to confirm its previewed Change impact', () => {
  expect(
    decideChangeImpactVersion({ change: 'unlock', sentVersion: undefined, version: 'current' }),
  ).toMatchObject({ kind: 'REJECTED', reason: 'TEACHER_BLOCK_PREVIEW_STALE' });
});
