import 'server-only';
import {
  getAcademicOverviewApi as projectApi,
  getAcademicOverviewPage as projectPage,
  type AcademicOverviewActor,
} from '@/features/academic-overview/server';
import {
  readRoadmapClosureCalendar,
  synchronizeAcademicParticipations,
} from '@/features/roadmap/server';

/** The synchronized U-Campus courses and the Roadmap closure calendar the overview reads. */
async function overviewSources(actor: AcademicOverviewActor) {
  const [source, isPastClosure] = await Promise.all([
    synchronizeAcademicParticipations(actor),
    readRoadmapClosureCalendar(),
  ]);
  return { source, isPastClosure };
}

export async function getAcademicOverviewApi(actor: AcademicOverviewActor) {
  return projectApi(actor, await overviewSources(actor));
}

export async function getAcademicOverviewPage(actor: AcademicOverviewActor) {
  return projectPage(actor, await overviewSources(actor));
}
