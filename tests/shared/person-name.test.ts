import { expect, test } from 'vitest';
import { rosterPersonName } from '@/shared/person-name';

test.each([
  [
    { firstName: 'Ana', secondName: 'María', firstSurname: 'Pérez', secondSurname: 'Soto' },
    'Pérez Soto, Ana María',
  ],
  [{ firstName: 'María', secondName: 'José', firstSurname: 'Cifuentes' }, 'Cifuentes, María José'],
  [{ firstName: 'Ana', secondSurname: 'Soto' }, 'Soto, Ana'],
  [{ firstSurname: 'De la Cruz', secondSurname: 'Soto', firstName: 'Ana' }, 'De la Cruz Soto, Ana'],
  [{ firstName: ' Ana ', secondName: ' ', firstSurname: ' Pérez ' }, 'Pérez, Ana'],
  [{ firstName: 'Ana' }, 'Ana'],
  [{ firstSurname: 'Pérez' }, 'Pérez'],
  [{}, ''],
])('formats known name parts and omits missing values: %j', (parts, expected) => {
  expect(rosterPersonName(parts)).toBe(expected);
});
