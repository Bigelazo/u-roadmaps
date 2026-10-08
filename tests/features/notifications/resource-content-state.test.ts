import { expect, test } from 'vitest';
import { resourceContentState } from '@/shared/server/resource-content-state';
import { reconcileResourceNotice } from '@/features/notifications/application/reconcile-resource';

const original = {
  title: 'Guía',
  url: 'https://example.test/guide',
  type: 'LINK',
  fileKey: null,
  fileContentType: null,
};

test('restoring every Resource field withdraws the pending change despite a newer timestamp', () => {
  const known = resourceContentState({ ...original, updatedAt: new Date('2026-01-01') });
  const changed = resourceContentState({ ...original, url: 'https://example.test/new' });
  expect(reconcileResourceNotice(known, changed)?.changeKind).toBe('resource-updated');
  const restored = resourceContentState({ ...original, updatedAt: new Date('2026-01-03') });
  expect(reconcileResourceNotice(known, restored)).toBeNull();
});

test('each meaningful Resource field changes the opaque revision without disclosing its contents', () => {
  const known = resourceContentState(original);
  for (const field of ['title', 'url', 'type', 'fileKey', 'fileContentType'] as const) {
    const changed = resourceContentState({ ...original, [field]: 'different' });
    expect(changed.revision).not.toBe(known.revision);
    expect(changed.revision).not.toContain('different');
    expect(reconcileResourceNotice(known, changed)?.changeKind).toBe('resource-updated');
  }
});
