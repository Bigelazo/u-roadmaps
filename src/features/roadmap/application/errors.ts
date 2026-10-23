import 'server-only';

import { ApplicationError } from '@/shared/errors/server';

export const roadmapNotFound = () =>
  new ApplicationError(
    404,
    'ROADMAP_NOT_FOUND',
    'El profesor todavía no ha creado un roadmap para este curso.',
  );

export const forbidden = (message = 'No tienes participación vigente para esta operación.') =>
  new ApplicationError(403, 'FORBIDDEN', message);

export const roadmapClosed = (message = 'Este roadmap está cerrado y es de sólo lectura.') =>
  new ApplicationError(409, 'ROADMAP_CLOSED', message);

export const conflict = (message = 'La operación entra en conflicto con otra modificación.') =>
  new ApplicationError(409, 'CONFLICT', message);

export const nodeNotFound = () =>
  new ApplicationError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');

export const resourceNotFound = (message = 'El recurso no existe en este roadmap.') =>
  new ApplicationError(404, 'RESOURCE_NOT_FOUND', message);
