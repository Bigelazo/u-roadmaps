import { err, ok } from 'neverthrow';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const invalidVtiClaims = 'INVALID_VTI_CLAIMS' as const;

export function normalizeInstitutionalEmail(value: unknown) {
  if (typeof value !== 'string') return err(invalidVtiClaims);

  const email = value.trim().toLocaleLowerCase('es-CL');
  if (!email || email.length > 320 || !emailPattern.test(email)) return err(invalidVtiClaims);

  return ok(email);
}

export function parseVtiIdentification(value: unknown) {
  if (typeof value !== 'string') return err(invalidVtiClaims);

  const rawIdentification = value.trim();
  const isPlain = /^\d{2,}[0-9kK]$/.test(rawIdentification);
  const isHyphenated = /^\d{2,}-[0-9kK]$/.test(rawIdentification);
  const isDotted = /^\d{1,3}(?:\.\d{3})+-[0-9kK]$/.test(rawIdentification);
  if (!isPlain && !isHyphenated && !isDotted) return err(invalidVtiClaims);

  const body = rawIdentification.replace(/[.-]/g, '').slice(0, -1).replace(/^0+/, '');
  return body ? ok(body) : err(invalidVtiClaims);
}

export function requireVtiClaim(value: unknown) {
  return typeof value === 'string' && value.trim() ? ok(value.trim()) : err(invalidVtiClaims);
}
