import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeInstitutionalEmail, parseVtiIdentification } from '@/lib/vti';

test('parses VTI identification into the canonical RUT body', () => {
  assert.equal(parseVtiIdentification('000012345678-5')._unsafeUnwrap(), '12345678');
  assert.equal(parseVtiIdentification('12.345.678-K')._unsafeUnwrap(), '12345678');
});

test('rejects empty and malformed VTI identification claims', () => {
  for (const value of ['', '0000-0', '12345678-', 'abc-5', null]) {
    assert.equal(
      parseVtiIdentification(value).match(
        () => null,
        (error) => error.code,
      ),
      'INVALID_VTI_CLAIMS',
    );
  }
});

test('normalizes and validates institutional email', () => {
  assert.equal(
    normalizeInstitutionalEmail('  PERSONA@UCHILE.CL ')._unsafeUnwrap(),
    'persona@uchile.cl',
  );
  for (const value of ['not-an-email', '']) {
    assert.equal(
      normalizeInstitutionalEmail(value).match(
        () => null,
        (error) => error.code,
      ),
      'INVALID_VTI_CLAIMS',
    );
  }
});
