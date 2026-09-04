import { expect, test } from 'vitest';
import { nodeTypeIconRegistry } from '@/features/roadmap/node-type-icon-registry';
import {
  isNodeTypeColor,
  isNodeTypeIconId,
  nodeTypeColorPalette,
  teachingIconCatalog,
} from '@/features/roadmap/node-type-appearance';

test('defines the approved twenty-color palette and rejects arbitrary hexadecimal colors', () => {
  expect(nodeTypeColorPalette).toHaveLength(20);
  expect(isNodeTypeColor('#024ad8')).toBe(true);
  expect(isNodeTypeColor('#ABCDEF')).toBe(false);
});

test('defines eighty teaching icons through the explicit registry', () => {
  const iconIds = teachingIconCatalog.flatMap(({ icons }) => icons.map(([id]) => id));

  expect(iconIds).toHaveLength(80);
  expect(new Set(iconIds)).toHaveLength(80);
  expect(iconIds.every((id) => id in nodeTypeIconRegistry)).toBe(true);
  expect('Shapes' in nodeTypeIconRegistry).toBe(true);
  expect(isNodeTypeIconId('BookOpen')).toBe(true);
  expect(isNodeTypeIconId('NotAnIcon')).toBe(false);
});
