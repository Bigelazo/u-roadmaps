import { redirect } from 'next/navigation';
import CreateRoadmapButton from '@/app/_components/CreateRoadmapButton';
import { AcademicOverview } from '@/features/academic-overview';
import { getAcademicOverviewPage } from '@/features/academic-overview/server';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';
import { getInboxIdentity } from '@/features/notifications/server';
import { UnavailableNoticeFallback } from '@/features/notifications';

export default async function AcademicOverviewPage(props: PageProps<'/academic-overview'>) {
  const searchParams = await props.searchParams;
  const noticeId = typeof searchParams.notice === 'string' ? searchParams.notice : null;
  const reason =
    searchParams.noticeFallback === 'course-unavailable'
      ? 'course-unavailable'
      : 'roadmap-unavailable';
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');

  return (
    <>
      {noticeId ? <UnavailableNoticeFallback noticeId={noticeId} reason={reason} /> : null}
      <AcademicOverview
        overview={await getAcademicOverviewPage(user)}
        notificationsEnabled={Boolean(getInboxIdentity(user.id))}
        renderRoadmapCreation={(course) => <CreateRoadmapButton {...course} />}
      />
    </>
  );
}
