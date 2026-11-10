import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { parseCourseOfferingIdentifier } from '@/features/roadmap';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';
import { EmbeddedSessionConnection } from '@/app/_components/EmbeddedSessionConnection';

async function openedOutsideAFrame() {
  return (await headers()).get('sec-fetch-dest') === 'document';
}

export default async function EmbeddedCoursePage(
  props: PageProps<'/embed/courses/[courseCode]/[year]/[semester]'>,
) {
  const identifier = parseCourseOfferingIdentifier(await props.params);
  if (!identifier) notFound();
  const coursePath = `/courses/${encodeURIComponent(identifier.courseCode)}/${identifier.year}/${identifier.semester}`;

  const user = await resolveSessionUser(await getApplicationSession());
  if (user || (await openedOutsideAFrame())) redirect(coursePath);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-cloud">
      <EmbeddedSessionConnection />
    </main>
  );
}
