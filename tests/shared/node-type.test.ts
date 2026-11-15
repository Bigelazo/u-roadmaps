import { expect, test } from 'vitest';
import { nodeTypePaint, unknownNodeType } from '@/shared/node-type';

test('paints a stored hex color through its theme variant with the stored color as fallback', () => {
  expect(nodeTypePaint('#0F4C81')).toBe(
    'var(--node-type-0f4c81, color-mix(in srgb, #0F4C81 var(--node-type-strength, 100%), white))',
  );
});

test('leaves non-hex paints untouched', () => {
  expect(nodeTypePaint(unknownNodeType.color)).toBe('currentColor');
  expect(nodeTypePaint('var(--primary)')).toBe('var(--primary)');
  expect(nodeTypePaint(nodeTypePaint('#0F4C81'))).toBe(nodeTypePaint('#0F4C81'));
});
