import { ApiError } from '@/lib/roadmap-api';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInstitutionalEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(
      400,
      'INVALID_VTI_CLAIMS',
      'No fue posible validar la identidad institucional.',
    );
  }
  const email = value.trim().toLocaleLowerCase('es-CL');
  if (!email || email.length > 320 || !emailPattern.test(email)) {
    throw new ApiError(
      400,
      'INVALID_VTI_CLAIMS',
      'No fue posible validar la identidad institucional.',
    );
  }
  return email;
}

export function parseVtiIdentification(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(
      400,
      'INVALID_VTI_CLAIMS',
      'No fue posible validar la identidad institucional.',
    );
  }
  const rawIdentification = value.trim();
  const isPlain = /^\d{2,}[0-9kK]$/.test(rawIdentification);
  const isHyphenated = /^\d{2,}-[0-9kK]$/.test(rawIdentification);
  const isDotted = /^\d{1,3}(?:\.\d{3})+-[0-9kK]$/.test(rawIdentification);
  if (!isPlain && !isHyphenated && !isDotted) {
    throw new ApiError(
      400,
      'INVALID_VTI_CLAIMS',
      'No fue posible validar la identidad institucional.',
    );
  }
  const compact = rawIdentification.replace(/[.-]/g, '');
  const body = compact.slice(0, -1).replace(/^0+/, '');
  if (!body) {
    throw new ApiError(
      400,
      'INVALID_VTI_CLAIMS',
      'No fue posible validar la identidad institucional.',
    );
  }
  return body;
}

export function requireVtiClaim(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(
      400,
      'INVALID_VTI_CLAIMS',
      'No fue posible validar la identidad institucional.',
    );
  }
  return value.trim();
}
