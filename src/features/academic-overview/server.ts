import 'server-only';
import type { MufasaEnrolledCoursesResult } from '@/integrations/ucampus/server';

import type {
  AcademicOverviewActor,
  AcademicOverviewApiResponse,
  AcademicOverviewPage,
} from './types';

export type { AcademicOverviewActor } from './types';

/** Returns the page-specific, grouped projection of the Academic overview. */
export async function getAcademicOverviewPage(
  actor: AcademicOverviewActor,
  source?: MufasaEnrolledCoursesResult,
): Promise<AcademicOverviewPage> {
  const { getAcademicOverviewPage: getOverview } =
    await import('./application/get-academic-overview');
  return getOverview(actor, source);
}

/** Returns the API-specific projection without normalizing its observable order. */
export async function getAcademicOverviewApi(
  actor: AcademicOverviewActor,
  source?: MufasaEnrolledCoursesResult,
): Promise<AcademicOverviewApiResponse> {
  const { getAcademicOverviewApi: getOverview } =
    await import('./application/get-academic-overview');
  return getOverview(actor, source);
}
