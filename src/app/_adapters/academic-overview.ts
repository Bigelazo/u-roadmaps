import 'server-only';
import {
  getAcademicOverviewApi as projectApi,
  getAcademicOverviewPage as projectPage,
  type AcademicOverviewActor,
} from '@/features/academic-overview/server';
import { synchronizeAcademicParticipations } from '@/features/roadmap/server';

export async function getAcademicOverviewApi(actor: AcademicOverviewActor) {
  return projectApi(actor, await synchronizeAcademicParticipations(actor));
}

export async function getAcademicOverviewPage(actor: AcademicOverviewActor) {
  return projectPage(actor, await synchronizeAcademicParticipations(actor));
}
