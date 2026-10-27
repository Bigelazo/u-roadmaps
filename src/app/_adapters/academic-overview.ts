import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import 'server-only';
import {
  getAcademicOverviewApi as projectApi,
  getAcademicOverviewPage as projectPage,
  type AcademicOverviewActor,
} from '@/features/academic-overview/server';
import { readRoadmapClosureCalendar, synchronizeAcademicHistory } from '@/features/roadmap/server';
import type { UCampus } from '@/integrations/ucampus/server';

type OverviewUser = AcademicOverviewActor & Readonly<{ ucampus: UCampus }>;

async function overviewSources(user: OverviewUser) {
  const [history, isPastClosure] = await Promise.all([
    synchronizeAcademicHistory(user, roadmapChangePort),
    readRoadmapClosureCalendar(),
  ]);
  return { history, isPastClosure };
}

export async function getAcademicOverviewApi(user: OverviewUser) {
  return projectApi(user, await overviewSources(user));
}

export async function getAcademicOverviewPage(user: OverviewUser) {
  return projectPage(user, await overviewSources(user));
}
