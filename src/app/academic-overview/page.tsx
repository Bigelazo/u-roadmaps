import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { CreateRoadmapDialog } from '@/features/roadmap';
import { isFirstVisitInvitationDue } from '@/features/roadmap/server';
import { AcademicOverview } from '@/features/academic-overview';
import { getAcademicOverviewPage } from '@/app/_adapters/academic-overview';
import { getApplicationSession } from '@/shared/server/session';
import { resolveSessionUser } from '@/app/_adapters/auth';
import { getInboxIdentity } from '@/features/notifications/server';
import { UnavailableNoticeFallback } from '@/features/notifications';

export default async function AcademicOverviewPage(props: PageProps<'/academic-overview'>) {
  const searchParams = await props.searchParams;
  const noticeId = typeof searchParams.notice === 'string' ? searchParams.notice : null;
  const reason =
    searchParams.noticeFallback === 'course-unavailable'
      ? 'course-unavailable'
      : searchParams.noticeFallback === 'roadmap-unavailable'
        ? 'roadmap-unavailable'
        : null;
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) redirect('/api/plogin/start');

  return (
    <AcademicOverview
      overview={await getAcademicOverviewPage(user)}
      notificationsEnabled={Boolean(getInboxIdentity(user.id))}
      notice={
        searchParams.accessLost === '1' ? (
          <Alert role="status">
            <AlertTitle>Ya no tienes acceso a ese roadmap</AlertTitle>
            <AlertDescription>
              Tu participación en el curso cambió. Aquí están los cursos en los que participas hoy.
            </AlertDescription>
          </Alert>
        ) : noticeId && reason ? (
          <UnavailableNoticeFallback reason={reason} />
        ) : null
      }
      renderRoadmapCreation={(course) => <CreateRoadmapDialog {...course} />}
      tutorialInvitation={await isFirstVisitInvitationDue(user.id)}
    />
  );
}
