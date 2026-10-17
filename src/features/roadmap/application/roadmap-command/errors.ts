import 'server-only';

import { ApplicationError } from '@/shared/errors/server';
import {
  decideRoadmapCapability,
  type CapabilityParticipation,
  type CapabilityRoadmap,
  type RoadmapCapability,
  type RoadmapRefusal,
} from '@/features/roadmap/domain/roadmap-capability';

/** The single source of the Roadmap's access refusals and their HTTP contract. */
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

const REFUSAL_ERRORS: Readonly<Record<RoadmapRefusal, () => ApplicationError>> = {
  ROADMAP_NOT_FOUND: roadmapNotFound,
  FORBIDDEN: () => forbidden(),
  ROADMAP_CLOSED: () => roadmapClosed(),
};

/** Decides the Roadmap capability and throws its refusal, or returns what it decided over. */
export function requireRoadmapCapability<
  Participation extends CapabilityParticipation,
  Roadmap extends CapabilityRoadmap,
>(input: {
  capability: RoadmapCapability;
  participation: Participation | null;
  roadmap: Roadmap | null;
}) {
  const decision = decideRoadmapCapability(input);
  if (decision.kind === 'REJECTED') throw REFUSAL_ERRORS[decision.reason]();
  return decision;
}
