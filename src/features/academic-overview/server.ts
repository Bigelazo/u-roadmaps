import 'server-only';

import type {
  AcademicOverviewActor,
  AcademicOverviewApiResponse,
  AcademicOverviewPage,
  AcademicOverviewSources,
} from './types';

export type { AcademicOverviewActor, AcademicOverviewSources } from './types';

export async function getAcademicOverviewPage(
  actor: AcademicOverviewActor,
  sources: AcademicOverviewSources,
): Promise<AcademicOverviewPage> {
  const { getAcademicOverviewPage: getOverview } =
    await import('./application/get-academic-overview');
  return getOverview(actor, sources);
}

export async function getAcademicOverviewApi(
  actor: AcademicOverviewActor,
  sources: AcademicOverviewSources,
): Promise<AcademicOverviewApiResponse> {
  const { getAcademicOverviewApi: getOverview } =
    await import('./application/get-academic-overview');
  return getOverview(actor, sources);
}
