import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeInstitutionalEmail, parseVtiIdentification } from '@/lib/vti';

test('parses VTI identification into the canonical RUT body', () => {
  assert.equal(parseVtiIdentification('000012345678-5'), '12345678');
  assert.equal(parseVtiIdentification('12.345.678-K'), '12345678');
});

test('rejects empty and malformed VTI identification claims', () => {
  for (const value of ['', '0000-0', '12345678-', 'abc-5', null]) {
    assert.throws(() => parseVtiIdentification(value));
  }
});

test('normalizes and validates institutional email', () => {
  assert.equal(normalizeInstitutionalEmail('  PERSONA@UCHILE.CL '), 'persona@uchile.cl');
  assert.throws(() => normalizeInstitutionalEmail('not-an-email'));
  assert.throws(() => normalizeInstitutionalEmail(''));
});
