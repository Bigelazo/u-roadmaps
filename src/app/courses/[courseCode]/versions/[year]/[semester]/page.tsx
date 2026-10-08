import { notFound, redirect } from 'next/navigation';
import { readRoadmapVersion } from '@/features/roadmap/server';
import { parseCourseOfferingIdentifier, RoadmapVersionViewer } from '@/features/roadmap';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';

export default async function RoadmapVersionPage(
  props: PageProps<'/courses/[courseCode]/versions/[year]/[semester]'>,
) {
  const identifier = parseCourseOfferingIdentifier(await props.params);
  if (!identifier) notFound();
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');
  // Every refusal arrives as a missing version.
  const version = await readRoadmapVersion(user, identifier).match(
    (value) => value,
    (error) => {
      if (error.status === 404) return null;
      throw error;
    },
  );
  if (!version) notFound();
  return <RoadmapVersionViewer version={version} />;
}
