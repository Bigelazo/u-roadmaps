import { expect, it } from 'vitest';
import {
  normalizeInstitutionalEmail,
  parseVtiIdentification,
} from '@/integrations/vti/server/claims';

it('parses VTI identification into the canonical RUT body', () => {
  expect(parseVtiIdentification('000012345678-5')._unsafeUnwrap()).toBe('12345678');
  expect(parseVtiIdentification('12.345.678-K')._unsafeUnwrap()).toBe('12345678');
});

it('rejects empty and malformed VTI identification claims', () => {
  for (const value of ['', '0000-0', '12345678-', 'abc-5', null]) {
    expect(
      parseVtiIdentification(value).match(
        () => null,
        (error) => error,
      ),
    ).toBe('INVALID_VTI_CLAIMS');
  }
});

it('normalizes and validates institutional email', () => {
  expect(normalizeInstitutionalEmail('  PERSONA@UCHILE.CL ')._unsafeUnwrap()).toBe(
    'persona@uchile.cl',
  );
  for (const value of ['not-an-email', '']) {
    expect(
      normalizeInstitutionalEmail(value).match(
        () => null,
        (error) => error,
      ),
    ).toBe('INVALID_VTI_CLAIMS');
  }
});
