import { expect, test } from 'vitest';
import { nodeAccessChangeText } from '@/shared/node-access';

test.each([
  ['Disponible', 'Retirado', '«Variables» fue ocultado del Roadmap.'],
  ['Bloqueado', 'Retirado', '«Variables» fue ocultado del Roadmap.'],
  ['Retirado', 'Disponible', '«Variables» volvió a mostrarse en el Roadmap.'],
  ['Retirado', 'Bloqueado', '«Variables» volvió a mostrarse en el Roadmap, pero está bloqueado.'],
  ['Disponible', 'Bloqueado', '«Variables» fue bloqueado.'],
  ['Bloqueado', 'Disponible', '«Variables» fue desbloqueado.'],
])('describes %s → %s as what happened to the Node', (known, current, text) => {
  expect(nodeAccessChangeText('Variables', known, current)).toBe(text);
});
