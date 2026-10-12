import 'server-only';

import {
  isNodeTypeColor,
  isNodeTypeIconId,
  type NodeTypeColor,
  type NodeTypeIconId,
} from '@/features/roadmap/node-type-appearance';
import { ApplicationError } from '@/shared/errors/server';

export function requireString(value: unknown, field: string, maxLength?: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    (maxLength !== undefined && value.trim().length > maxLength)
  ) {
    throw new ApplicationError(400, 'INVALID_REQUEST', `${field} debe ser un texto no vacío.`);
  }
  return value.trim();
}

export function optionalString(
  value: unknown,
  field: string,
  maxLength?: number,
): string | null | undefined {
  if (value === undefined || value === null) return value === null ? null : undefined;
  return requireString(value, field, maxLength);
}

/** Validate optional Node description text without changing its exact content. */
export function nodeDescription(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string' || !value.trim())
    throw new ApplicationError(400, 'INVALID_REQUEST', 'description debe ser un texto no vacío.');
  return value;
}

export function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApplicationError(400, 'INVALID_REQUEST', `${field} debe ser un número finito.`);
  }
  return value;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ApplicationError(400, 'INVALID_REQUEST', `${field} debe ser booleano.`);
  }
  return value;
}

export function requireNodeTypeColor(value: unknown): NodeTypeColor {
  const color = requireString(value, 'color');
  if (!isNodeTypeColor(color)) {
    throw new ApplicationError(
      400,
      'INVALID_REQUEST',
      'color debe pertenecer a la paleta de tipos de nodo.',
    );
  }
  return color.toUpperCase() as NodeTypeColor;
}

export function requireNodeTypeIcon(value: unknown): NodeTypeIconId {
  const icon = requireString(value, 'icon');
  if (!isNodeTypeIconId(icon)) {
    throw new ApplicationError(
      400,
      'INVALID_REQUEST',
      'icon debe pertenecer al catálogo de íconos docentes.',
    );
  }
  return icon;
}

export function requireResourceType(value: unknown): 'FILE' | 'LINK' | 'VIDEO' {
  if (value !== 'FILE' && value !== 'LINK' && value !== 'VIDEO') {
    throw new ApplicationError(400, 'INVALID_RESOURCE_TYPE', 'type debe ser FILE, LINK o VIDEO.');
  }
  return value;
}

export function requireUrl(value: unknown): string {
  const url = requireString(value, 'url');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      throw new Error('Unsupported URL scheme');
  } catch {
    throw new ApplicationError(400, 'INVALID_URL', 'url debe ser una URL válida.');
  }
  return url;
}
