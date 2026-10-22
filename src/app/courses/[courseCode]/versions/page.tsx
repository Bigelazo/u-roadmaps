import { notFound, redirect } from 'next/navigation';
import { readRoadmapVersionHistory } from '@/features/roadmap/server';
import { parseCourseCode, RoadmapVersionHistory } from '@/features/roadmap';
import { ApplicationError } from '@/shared/errors/server';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';

export default async function RoadmapVersionHistoryPage(
  props: PageProps<'/courses/[courseCode]/versions'>,
) {
  const courseCode = parseCourseCode((await props.params).courseCode);
  if (!courseCode) notFound();
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  const history = await readRoadmapVersionHistory(user, courseCode).catch((error: unknown) => {
    if (error instanceof ApplicationError && (error.status === 403 || error.status === 404))
      return null;
    throw error;
  });
  if (!history) notFound();
  return <RoadmapVersionHistory history={history} />;
}
