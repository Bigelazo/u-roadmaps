import { notFound, redirect } from 'next/navigation';
import { readRoadmapVersionHistory } from '@/features/roadmap/server';
import { RoadmapVersionHistory } from '@/features/roadmap';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';

export default async function RoadmapVersionHistoryPage(
  props: PageProps<'/courses/[courseCode]/versions'>,
) {
  const { courseCode } = await props.params;
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  // Students and outsiders get the same answer as a missing Course.
  const history = await readRoadmapVersionHistory(user, courseCode).match(
    (value) => value,
    (error) => {
      if (error.status === 403 || error.status === 404) return null;
      throw error;
    },
  );
  if (!history) notFound();
  return <RoadmapVersionHistory history={history} />;
}
