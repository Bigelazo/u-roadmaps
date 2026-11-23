import { ApplicationError } from '@/shared/errors/types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

export function requireUuid(value: unknown, field: string): string {
  if (!isUuid(value)) {
    throw new ApplicationError(400, 'INVALID_REQUEST', `${field} debe ser un UUID válido.`);
  }
  return value;
}

export function requireOneOf<Value extends string>(
  value: unknown,
  field: string,
  allowed: readonly Value[],
) {
  if (allowed.includes(value as Value)) return value as Value;
  const options = new Intl.ListFormat('es', { type: 'disjunction' }).format(allowed);
  throw new ApplicationError(400, 'INVALID_REQUEST', `${field} debe ser ${options}.`);
}
