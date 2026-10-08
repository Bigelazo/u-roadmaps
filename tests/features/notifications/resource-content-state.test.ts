import { expect, test } from 'vitest';
import { resourceContentState } from '@/shared/server/resource-content-state';

const original = {
  title: 'Guía',
  url: 'https://example.test/guide',
  type: 'LINK',
  fileKey: null,
  fileContentType: null,
};

test('restoring every Resource field restores the content state despite a newer timestamp', () => {
  const known = resourceContentState({ ...original, updatedAt: new Date('2026-01-01') });
  const changed = resourceContentState({ ...original, url: 'https://example.test/new' });
  expect(changed).not.toEqual(known);
  const restored = resourceContentState({ ...original, updatedAt: new Date('2026-01-03') });
  expect(restored).toEqual(known);
});

test('each meaningful Resource field changes the opaque revision without disclosing its contents', () => {
  const known = resourceContentState(original);
  for (const field of ['title', 'url', 'type', 'fileKey', 'fileContentType'] as const) {
    const changed = resourceContentState({ ...original, [field]: 'different' });
    expect(changed.revision).not.toBe(known.revision);
    expect(changed.revision).not.toContain('different');
  }
});
