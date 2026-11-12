import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import 'server-only';
import {
  getAcademicOverviewApi as projectApi,
  getAcademicOverviewPage as projectPage,
  type AcademicOverviewActor,
  type AcademicOverviewBrowserResponse,
  createAcademicCourseCache,
} from '@/features/academic-overview/server';
import { readRoadmapClosureCalendar, synchronizeAcademicHistory } from '@/features/roadmap/server';
import type { UCampus } from '@/integrations/ucampus/server';

type OverviewUser = AcademicOverviewActor & Readonly<{ ucampus: UCampus }>;

const synchronizations = new Map<
  string,
  Promise<Awaited<ReturnType<typeof synchronizeAcademicHistory>>>
>();

function synchronizeOverview(user: OverviewUser) {
  const pending = synchronizations.get(user.id);
  if (pending) return pending;
  const request = synchronizeAcademicHistory(user, roadmapChangePort).finally(() => {
    if (synchronizations.get(user.id) === request) synchronizations.delete(user.id);
  });
  synchronizations.set(user.id, request);
  return request;
}

async function overviewSources(user: OverviewUser) {
  const [history, isPastClosure] = await Promise.all([
    synchronizeOverview(user),
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

export async function getAcademicOverviewBrowser(
  user: OverviewUser,
  synchronize: boolean,
): Promise<AcademicOverviewBrowserResponse> {
  const sources = synchronize
    ? await overviewSources(user)
    : {
        history: { status: 'unavailable' as const },
        isPastClosure: await readRoadmapClosureCalendar(),
      };
  const overview = await projectPage(user, sources);
  return {
    userId: user.id,
    overview,
    status: synchronize ? sources.history.status : 'local',
    cache:
      sources.history.status === 'complete'
        ? createAcademicCourseCache(user.id, sources.history.courses, Date.now())
        : null,
  };
}
