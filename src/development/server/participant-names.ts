import { rosterPersonName } from '@/shared/person-name';
import { fixtureUsers } from '../fixtures/catalog';

export async function readFixtureParticipantNames(ruts: readonly string[]) {
  const requested = new Set(ruts);
  return new Map(
    fixtureUsers
      .filter((user) => requested.has(user.rut))
      .map((user) => {
        // These fictional fixtures have one given name and two surnames, except María José.
        const parts = user.name.split(' ');
        const compoundGivenName = user.name === 'María José Cifuentes';
        return [
          user.rut,
          rosterPersonName({
            firstName: parts[0],
            secondName: compoundGivenName ? parts[1] : null,
            firstSurname: parts[compoundGivenName ? 2 : 1],
            secondSurname: compoundGivenName ? null : parts[2],
          }),
        ];
      }),
  );
}
