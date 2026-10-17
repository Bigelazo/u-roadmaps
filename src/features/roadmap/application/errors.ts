import 'server-only';

import { ApplicationError } from '@/shared/errors/server';

/** The single source of the Roadmap's shared refusals and their HTTP contract. */
export const roadmapNotFound = () =>
  new ApplicationError(
    404,
    'ROADMAP_NOT_FOUND',
    'El profesor todavía no ha creado un roadmap para este curso.',
  );

export const forbidden = (message = 'No tienes participación vigente para esta operación.') =>
  new ApplicationError(403, 'FORBIDDEN', message);

/** Every change to a closed Roadmap, Completions and Canvas preview included (ADR-0018). */
export const roadmapClosed = (message = 'Este roadmap está cerrado y es de sólo lectura.') =>
  new ApplicationError(409, 'ROADMAP_CLOSED', message);

/** The 409 once concurrent modifications exhausted every attempt (ADR-0015). */
export const conflict = (message = 'La operación entra en conflicto con otra modificación.') =>
  new ApplicationError(409, 'CONFLICT', message);

export const nodeNotFound = () =>
  new ApplicationError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');

export const resourceNotFound = (message = 'El recurso no existe en este roadmap.') =>
  new ApplicationError(404, 'RESOURCE_NOT_FOUND', message);
