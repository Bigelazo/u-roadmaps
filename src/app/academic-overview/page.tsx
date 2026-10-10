import { redirect } from 'next/navigation';
import { CreateRoadmapDialog } from '@/features/roadmap';
import { isFirstVisitInvitationDue } from '@/features/roadmap/server';
import { AcademicOverview } from '@/features/academic-overview';
import { getAcademicOverviewPage } from '@/app/_adapters/academic-overview';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';
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
    <>
      {searchParams.accessLost === '1' ? (
        <p role="status" className="mx-auto mt-6 max-w-3xl p-4">
          Tu Participación ya no tiene acceso a este Roadmap. Puedes revisar tus Cursos en el
          Resumen académico.
        </p>
      ) : null}
      {noticeId && reason ? <UnavailableNoticeFallback reason={reason} /> : null}
      <AcademicOverview
        overview={await getAcademicOverviewPage(user)}
        notificationsEnabled={Boolean(getInboxIdentity(user.id))}
        renderRoadmapCreation={(course) => <CreateRoadmapDialog {...course} />}
        tutorialInvitation={await isFirstVisitInvitationDue(user.id)}
      />
    </>
  );
}
