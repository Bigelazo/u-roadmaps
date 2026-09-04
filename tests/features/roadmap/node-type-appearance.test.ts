import * as lucideIcons from 'lucide-react';
import { expect, test } from 'vitest';
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

test('defines eighty installed Lucide teaching icons', () => {
  const iconIds = teachingIconCatalog.flatMap(({ icons }) => icons.map(([id]) => id));

  expect(iconIds).toHaveLength(80);
  expect(new Set(iconIds)).toHaveLength(80);
  expect(iconIds.every((id) => id in lucideIcons)).toBe(true);
  expect('Shapes' in lucideIcons).toBe(true);
  expect(isNodeTypeIconId('BookOpen')).toBe(true);
  expect(isNodeTypeIconId('NotAnIcon')).toBe(false);
});
