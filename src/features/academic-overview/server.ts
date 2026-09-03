import 'server-only';

import type {
  AcademicOverviewActor,
  AcademicOverviewApiResponse,
  AcademicOverviewPage,
} from './types';

export type { AcademicOverviewActor } from './types';

/** Returns the page-specific, grouped projection of the Academic overview. */
export async function getAcademicOverviewPage(
  actor: AcademicOverviewActor,
): Promise<AcademicOverviewPage> {
  const { getAcademicOverviewPage: getOverview } = await import('./application/get-academic-overview');
  return getOverview(actor);
}

/** Returns the API-specific projection without normalizing its observable order. */
export async function getAcademicOverviewApi(
  actor: AcademicOverviewActor,
): Promise<AcademicOverviewApiResponse> {
  const { getAcademicOverviewApi: getOverview } = await import('./application/get-academic-overview');
  return getOverview(actor);
}
