import { expect, test } from 'vitest';
import { readFixtureParticipantNames } from '@/development/server';
import { fixtureUsers } from '@/development/fixtures/catalog';

test('development roster names preserve both given names and omit the absent surname', async () => {
  const maria = fixtureUsers.find((user) => user.name === 'María José Cifuentes')!;
  const names = await readFixtureParticipantNames(['10000001', maria.rut, 'unknown']);
  expect([...names]).toEqual([
    ['10000001', 'Rojas Mella, Daniela'],
    [maria.rut, 'Cifuentes, María José'],
  ]);
});
