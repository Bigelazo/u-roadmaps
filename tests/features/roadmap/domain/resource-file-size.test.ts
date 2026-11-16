import { expect, test } from 'vitest';
import { resourceFileError } from '@/features/roadmap/domain/resource';

const tenMegabytes = 10 * 1024 * 1024;

test('a file of exactly 10 MB is accepted', () => {
  expect(resourceFileError({ size: tenMegabytes })).toBeNull();
});

test('a file over 10 MB is rejected with the 10 MB message', () => {
  expect(resourceFileError({ size: tenMegabytes + 1 })).toBe('El archivo supera los 10 MB.');
});
