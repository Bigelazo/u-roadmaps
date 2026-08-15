import { ApiError } from '@/lib/roadmap-api';
import { err, ok } from 'neverthrow';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalidVtiClaims() {
  return new ApiError(
    400,
    'INVALID_VTI_CLAIMS',
    'No fue posible validar la identidad institucional.',
  );
}

export function normalizeInstitutionalEmail(value: unknown) {
  if (typeof value !== 'string') {
    return err(invalidVtiClaims());
  }
  const email = value.trim().toLocaleLowerCase('es-CL');
  if (!email || email.length > 320 || !emailPattern.test(email)) {
    return err(invalidVtiClaims());
  }
  return ok(email);
}

export function parseVtiIdentification(value: unknown) {
  if (typeof value !== 'string') {
    return err(invalidVtiClaims());
  }
  const rawIdentification = value.trim();
  const isPlain = /^\d{2,}[0-9kK]$/.test(rawIdentification);
  const isHyphenated = /^\d{2,}-[0-9kK]$/.test(rawIdentification);
  const isDotted = /^\d{1,3}(?:\.\d{3})+-[0-9kK]$/.test(rawIdentification);
  if (!isPlain && !isHyphenated && !isDotted) {
    return err(invalidVtiClaims());
  }
  const compact = rawIdentification.replace(/[.-]/g, '');
  const body = compact.slice(0, -1).replace(/^0+/, '');
  if (!body) {
    return err(invalidVtiClaims());
  }
  return ok(body);
}

export function requireVtiClaim(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return err(invalidVtiClaims());
  }
  return ok(value.trim());
}
