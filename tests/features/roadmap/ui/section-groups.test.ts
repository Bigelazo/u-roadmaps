import { expect, test } from 'vitest';
import { groupBySections } from '@/features/roadmap/ui/section-groups';

test('groups members by sections, widest coverage first and members without section last', () => {
  const member = (name: string, sections: string[]) => ({ name, sections });
  const groups = groupBySections([
    member('Sin', []),
    member('Diez', ['10']),
    member('Dos', ['2']),
    member('Todas', ['1', '2', '3']),
    member('Otra dos', ['2']),
  ]);
  expect(groups.map(({ label, members }) => [label, members.map(({ name }) => name)])).toEqual([
    ['Secciones 1, 2, 3', ['Todas']],
    ['Sección 2', ['Dos', 'Otra dos']],
    ['Sección 10', ['Diez']],
    ['Sin sección', ['Sin']],
  ]);
});
